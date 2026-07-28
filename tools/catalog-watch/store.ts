/**
 * catalog-watch — Supabase-store (a `CrawlStore` valós implementációja).
 *
 * Ez az EGYETLEN fájl a figyelőben, amely adatbázist ír. A kulcs SERVICE-ROLE:
 * GitHub Actions secretből jön, kliensbe SOHA nem kerül (terv „Futtatási
 * környezet"). A service-role megkerüli az RLS-t, ezért itt a fegyelem a
 * védelem: a figyelő kizárólag `board_prices`-t, `boards.last_seen_at`/
 * `availability_hu`-t és `catalog_candidates`-t ír — `boards` SORT NEM HOZ
 * LÉTRE. Új típus csak az admin-jóváhagyáson át születhet.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CandidateInput, CrawlStore } from "./crawl.ts";
import type { SupabaseTarget } from "./env.ts";
import { shouldRecordPrice } from "./lifecycle.ts";
import type { BoardForLifecycle } from "./lifecycle.ts";
import type { BoardForMatch, CatalogSourceRow } from "./types.ts";

/**
 * Service-role kliens a FELOLDOTT célra (lásd `env.ts`: a repo .env-je az
 * autoritás, és a kulcs projektjét ellenőrizzük). A kulcsot SOHA nem írjuk ki —
 * a hibaüzenetek is csak változó-nevet és projekt-refet említenek.
 */
export function createServiceClient(target: SupabaseTarget): SupabaseClient {
  return createClient(target.url, target.key, { auth: { persistSession: false } });
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/** Az aktív figyelt források (a crawl bemenete). */
export async function listSources(
  client: SupabaseClient,
  options: { onlyActive?: boolean } = {},
): Promise<CatalogSourceRow[]> {
  let query = client.from("catalog_sources").select("*").order("name");
  if (options.onlyActive !== false) query = query.eq("active", true);
  const { data, error } = await query;
  fail("catalog_sources olvasás", error);
  return (data ?? []) as CatalogSourceRow[];
}

/** Új figyelt forrás (`add-source` CLI-parancs). */
export async function insertSource(
  client: SupabaseClient,
  source: Pick<CatalogSourceRow, "name" | "base_url" | "kind"> &
    Partial<Pick<CatalogSourceRow, "country" | "crawl_config" | "discovery">>,
): Promise<CatalogSourceRow> {
  const { data, error } = await client
    .from("catalog_sources")
    .insert({
      name: source.name,
      base_url: source.base_url,
      kind: source.kind,
      country: source.country ?? "HU",
      discovery: source.discovery ?? "manual",
      crawl_config: source.crawl_config ?? null,
    })
    .select("*")
    .single();
  fail("catalog_sources insert", error);
  return data as CatalogSourceRow;
}

/** Az életciklus-vizsgálat bemenete (minden deszka, kevés oszloppal). */
export async function listBoardsForLifecycle(
  client: SupabaseClient,
): Promise<BoardForLifecycle[]> {
  const { data, error } = await client
    .from("boards")
    .select("id, model_name, status, last_seen_at, availability_hu");
  fail("boards olvasás", error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    modelName: row.model_name as string,
    status: row.status as string,
    last_seen_at: row.last_seen_at as string | null,
    availability_hu: row.availability_hu as boolean,
  }));
}

/** A crawl írási oldala. */
export function createSupabaseStore(client: SupabaseClient): CrawlStore {
  return {
    async listBoardsForMatch(): Promise<BoardForMatch[]> {
      const { data, error } = await client
        .from("boards")
        .select("id, model_name, model_year, brand:brands(name)");
      fail("boards olvasás", error);
      return (data ?? []).map((row) => {
        // A PostgREST a to-one joint objektumként adja; régebbi/aliasolt
        // válaszban tömb is lehet — mindkettőt elviseljük.
        const brand = row.brand as { name?: string } | { name?: string }[] | null;
        const brandName = Array.isArray(brand) ? (brand[0]?.name ?? null) : (brand?.name ?? null);
        return {
          id: row.id as string,
          modelName: row.model_name as string,
          modelYear: (row.model_year as number | null) ?? null,
          brandName,
        };
      });
    },

    async recordPrice(input): Promise<void> {
      const { data, error } = await client
        .from("board_prices")
        .select("price_huf")
        .eq("board_id", input.boardId)
        .eq("shop_name", input.shopName)
        .order("recorded_at", { ascending: false })
        .limit(1);
      fail("board_prices olvasás", error);

      const previous = (data?.[0]?.price_huf as number | undefined) ?? null;
      if (!shouldRecordPrice(previous, input.priceHuf)) return;

      const { error: insertError } = await client.from("board_prices").insert({
        board_id: input.boardId,
        shop_name: input.shopName,
        url: input.url,
        price_huf: input.priceHuf,
      });
      fail("board_prices insert", insertError);
    },

    async markBoardSeen(input): Promise<void> {
      const patch: Record<string, unknown> = { last_seen_at: input.seenAt };
      // Az elérhetőséget csak akkor állítjuk, ha a forrás tényleg mondott
      // róla valamit — a hallgatás nem jelent „nincs készleten"-t.
      if (input.inStock !== null) patch.availability_hu = input.inStock;

      const { error } = await client.from("boards").update(patch).eq("id", input.boardId);
      fail("boards update", error);
    },

    async saveCandidate(input: CandidateInput): Promise<boolean> {
      const { data, error } = await client
        .from("catalog_candidates")
        .select("id, status")
        .eq("url", input.url)
        .limit(1);
      fail("catalog_candidates olvasás", error);

      const existing = data?.[0] as { id: string; status: string } | undefined;
      const payload = {
        source_id: input.sourceId,
        url: input.url,
        raw: input.raw,
        extracted: input.extracted,
        matched_board_id: input.matchedBoardId,
        match_confidence: input.confidence,
      };

      if (existing) {
        // Az ELBÍRÁLT URL-t nem támasztjuk fel: ha az admin elutasította vagy
        // már összefésülte, a következő crawl nem hozhatja vissza a sorba.
        if (existing.status !== "pending") return false;
        const { error: updateError } = await client
          .from("catalog_candidates")
          .update(payload)
          .eq("id", existing.id);
        fail("catalog_candidates update", updateError);
        return false;
      }

      const { error: insertError } = await client
        .from("catalog_candidates")
        .insert({ ...payload, status: "pending" });
      fail("catalog_candidates insert", insertError);
      return true;
    },

    async markSourceCrawled(sourceId: string, at: string): Promise<void> {
      const { error } = await client
        .from("catalog_sources")
        .update({ last_crawled_at: at })
        .eq("id", sourceId);
      fail("catalog_sources update", error);
    },
  };
}

/** Egy dry-run futás alatt összegyűjtött írási SZÁNDÉKOK. */
export interface DryRunLog {
  prices: { boardId: string; shopName: string; priceHuf: number }[];
  seen: { boardId: string; inStock: boolean | null }[];
  candidates: { url: string; modelName: string; matchedBoardId: string | null }[];
}

/**
 * Dry-run store: VALÓS adatot olvas (hogy az egyezés-keresés igazat mutasson),
 * de semmit nem ír — az írási szándékokat gyűjti. Ez a `--dry-run` motorja:
 * új forrás bekötése előtt így látható, mit tenne a figyelő.
 */
export function createDryRunStore(client: SupabaseClient): {
  store: CrawlStore;
  log: DryRunLog;
} {
  const real = createSupabaseStore(client);
  const log: DryRunLog = { prices: [], seen: [], candidates: [] };

  return {
    log,
    store: {
      listBoardsForMatch: () => real.listBoardsForMatch(),
      async recordPrice(input) {
        log.prices.push({
          boardId: input.boardId,
          shopName: input.shopName,
          priceHuf: input.priceHuf,
        });
      },
      async markBoardSeen(input) {
        log.seen.push({ boardId: input.boardId, inStock: input.inStock });
      },
      async saveCandidate(input) {
        log.candidates.push({
          url: input.url,
          modelName: input.extracted.modelName,
          matchedBoardId: input.matchedBoardId,
        });
        return true;
      },
      async markSourceCrawled() {},
    },
  };
}
