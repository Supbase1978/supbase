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
import { applyFieldLocks } from "./lock.ts";
import { buildAccessoryInsertPayload, buildBoardInsertPayload } from "./approve.ts";
import { slugify } from "../../src/core/text/slug.ts";
import type { GearCategory } from "../../src/modules/catalog/gear.ts";
import type {
  BoardForMatch,
  BoardSpecs,
  BoardType,
  CatalogSourceRow,
  ExtractedProduct,
} from "./types.ts";

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

/**
 * MINDEN forrás, az inaktívakkal együtt — a tömeges jóváhagyáshoz kell, mert
 * a jelöltek egy azóta kikapcsolt forrásból is származhatnak.
 */
export async function listAllSources(client: SupabaseClient): Promise<CatalogSourceRow[]> {
  return listSources(client, { onlyActive: false });
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

/** Egy katalógus-sor a kép-visszatöltéshez (`backfill-images`). */
export interface BoardForImageBackfill {
  id: string;
  modelName: string;
  kind: string;
  imageUrl: string | null;
}

/**
 * A kép-visszatöltés bemenete. SZÁNDÉKOSAN kind-AGNOSZTIKUS: képre a deszkának
 * ÉS a kiegészítőnek is szüksége van, és ez nem listázás — a sorokat nem a
 * felhasználó látja, hanem a saját forrás-oldalukhoz párosítjuk.
 */
export async function listBoardsForImageBackfill(
  client: SupabaseClient,
  options: { includeWithImage?: boolean } = {},
): Promise<BoardForImageBackfill[]> {
  let query = client.from("boards").select("id, model_name, kind, image_url");
  if (options.includeWithImage !== true) query = query.is("image_url", null);
  const { data, error } = await query;
  fail("boards olvasás", error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    modelName: row.model_name as string,
    kind: row.kind as string,
    imageUrl: (row.image_url as string | null) ?? null,
  }));
}

/**
 * A megtalált termékkép rögzítése. A figyelő `boards` SORT NEM HOZ LÉTRE — ez
 * a meglévő, moderátor által jóváhagyott soron tölt ki EGY mezőt.
 */
export async function updateBoardImage(
  client: SupabaseClient,
  boardId: string,
  imageUrl: string,
): Promise<void> {
  const { error } = await client.from("boards").update({ image_url: imageUrl }).eq("id", boardId);
  fail("boards update (image_url)", error);
}

/** Egy katalógus-sor a galéria-visszatöltéshez. */
export interface BoardForGalleryBackfill {
  id: string;
  modelName: string;
  imageUrl: string | null;
  galleryCount: number;
}

/**
 * A galéria-visszatöltés bemenete. SZÁNDÉKOSAN kind-AGNOSZTIKUS: a teljes
 * képernyős nézet a kiegészítőknél is ugyanúgy működik, és ez nem listázás.
 */
export async function listBoardsForGalleryBackfill(
  client: SupabaseClient,
  options: { includeFilled?: boolean } = {},
): Promise<BoardForGalleryBackfill[]> {
  const { data, error } = await client.from("boards").select("id, model_name, image_url, images");
  fail("boards olvasás", error);
  return (data ?? [])
    .map((row) => ({
      id: row.id as string,
      modelName: row.model_name as string,
      imageUrl: (row.image_url as string | null) ?? null,
      galleryCount: Array.isArray(row.images) ? row.images.length : 0,
    }))
    .filter((row) => options.includeFilled === true || row.galleryCount === 0);
}

/**
 * A teljes képernyős nézet képeinek rögzítése (`boards.images`). A BORÍTÓ nem
 * itt van — az az `image_url`, amit a rács mutat.
 */
export async function updateBoardGallery(
  client: SupabaseClient,
  boardId: string,
  images: readonly string[],
): Promise<void> {
  const payload = images.map((url) => ({ url, source: "brand" }));
  const { error } = await client.from("boards").update({ images: payload }).eq("id", boardId);
  fail("boards update (images)", error);
}

/** A deszkához KÖTÖTT jelöltek (a kép a saját forrás-oldalról jön). */
export async function listCandidatesForBoards(
  client: SupabaseClient,
  boardIds: readonly string[],
): Promise<
  { boardId: string; url: string | null; status: string; sourceId: string; imageUrl: string | null }[]
> {
  const { data, error } = await client
    .from("catalog_candidates")
    .select("matched_board_id, url, status, source_id, extracted")
    .in("matched_board_id", [...boardIds]);
  fail("catalog_candidates olvasás", error);
  return (data ?? []).map((row) => ({
    boardId: row.matched_board_id as string,
    url: (row.url as string | null) ?? null,
    status: row.status as string,
    sourceId: row.source_id as string,
    imageUrl: ((row.extracted as { imageUrl?: string | null } | null)?.imageUrl ?? null) as
      | string
      | null,
  }));
}

/**
 * Az életciklus-vizsgálat bemenete (minden deszka, kevés oszloppal).
 * `kind = 'board'`: a `boards` tábla F2.3 óta a felszerelést is hordozza, az
 * életciklus-riport viszont deszkákról szól.
 */
export async function listBoardsForLifecycle(
  client: SupabaseClient,
): Promise<BoardForLifecycle[]> {
  const { data, error } = await client
    .from("boards")
    .select("id, model_name, status, last_seen_at, availability_hu")
    .eq("kind", "board");
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
    // `kind = 'board'`: a jelölt-egyeztetés DESZKÁRA keres párt (a crawl ma
    // csak deszkát enged tovább, `looksLikeBoard`). Kiegészítő-sorok bekeverése
    // hamis egyezést adna — pl. egy „Red Paddle" evező a „Red Paddle Ride"-ra.
    async listBoardsForMatch(): Promise<BoardForMatch[]> {
      const { data, error } = await client
        .from("boards")
        .select("id, model_name, model_year, brand:brands(name)")
        .eq("kind", "board");
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
        .select("id, status, extracted, locked_fields")
        .eq("url", input.url)
        .limit(1);
      fail("catalog_candidates olvasás", error);

      const existing = data?.[0] as
        | { id: string; status: string; extracted: ExtractedProduct | null; locked_fields: string[] | null }
        | undefined;

      if (existing) {
        // Az ELBÍRÁLT URL-t nem támasztjuk fel: ha az admin elutasította vagy
        // már összefésülte, a következő crawl nem hozhatja vissza a sorba.
        if (existing.status !== "pending") return false;

        // Mezőnkénti zár (F2.1-utó-10): ha egy admin/karmester kézzel
        // ellenőrzött és lezárt egy mezőt (`locked_fields`), a frissen
        // crawlolt érték NEM írhatja felül — az existing.extracted-ből
        // visszamásolva megy a mentésbe. Zárolt mező hiányában (üres lista,
        // vagy még nincs korábbi extracted) ez a korábbi, teljes felülírás.
        const lockedFields = existing.locked_fields ?? [];
        const extracted =
          lockedFields.length > 0 && existing.extracted
            ? applyFieldLocks(existing.extracted, input.extracted, lockedFields)
            : input.extracted;

        const { error: updateError } = await client
          .from("catalog_candidates")
          .update({
            source_id: input.sourceId,
            url: input.url,
            raw: input.raw,
            extracted,
            matched_board_id: input.matchedBoardId,
            match_confidence: input.confidence,
          })
          .eq("id", existing.id);
        fail("catalog_candidates update", updateError);
        return false;
      }

      const payload = {
        source_id: input.sourceId,
        url: input.url,
        raw: input.raw,
        extracted: input.extracted,
        matched_board_id: input.matchedBoardId,
        match_confidence: input.confidence,
      };

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
  candidates: {
    url: string;
    modelName: string;
    matchedBoardId: string | null;
    /** A jelölt specifikációja — a dry-run ELLENŐRZÉS lényege: mit írna be. */
    specs: BoardSpecs;
  }[];
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
          specs: input.extracted.specs,
        });
        return true;
      },
      async markSourceCrawled() {},
    },
  };
}

/**
 * Egy jóváhagyott jelölt beírása `boards`-ba, majd a hozzá tartozó
 * duplikátumok `merged`-re állítása (F2.1-utó-19).
 *
 * ITT SZÜLETIK ÚJ DESZKA a CLI-ből — ugyanaz a művelet, amit a moderációs UI
 * `approveCandidate`-je végez, csak tömegesen. A „figyelő sosem publikál
 * magától" elv NEM sérül: ezt a parancsot az ADMIN futtatja, a saját
 * döntéseként; a crawl továbbra sem ír `boards`-ba.
 */
export async function approveCandidateRow(
  client: SupabaseClient,
  input: {
    candidateId: string;
    extracted: ExtractedProduct;
    /** Deszkánál a kategória, KIEGÉSZÍTŐNÉL a gear-kategória. */
    boardType: BoardType | null;
    accessoryType: GearCategory | null;
    reviewerId: string;
    mergedCandidateIds: readonly string[];
  },
): Promise<{ ok: true; boardId: string } | { ok: false; error: string }> {
  const brandName = input.extracted.brandName;
  if (!brandName) return { ok: false, error: "nincs márkanév" };

  const brandId = await resolveBrandIdForApproval(client, brandName);
  if (!brandId) return { ok: false, error: `márka nem oldható fel: ${brandName}` };

  const seenAt = new Date().toISOString();
  const slug = await resolveUniqueSlugForApproval(
    client,
    slugify(`${brandName} ${input.extracted.modelName}`),
  );

  // A jelölt vagy DESZKA, vagy KIEGÉSZÍTŐ — a payload ennek megfelelően más
  // mezőt visel (`board_type` kontra `accessory_type`).
  const payload =
    input.accessoryType !== null
      ? buildAccessoryInsertPayload(input.extracted, {
          brandId,
          accessoryType: input.accessoryType,
          slug,
          seenAt,
        })
      : input.boardType !== null
        ? buildBoardInsertPayload(input.extracted, {
            brandId,
            boardType: input.boardType,
            slug,
            seenAt,
          })
        : null;
  if (!payload) return { ok: false, error: "nincs sem kategória, sem kiegészítő-típus" };

  const { data, error } = await client.from("boards").insert(payload).select("id").single();
  if (error || !data) return { ok: false, error: `boards insert: ${error?.message ?? "?"}` };
  const boardId = (data as { id: string }).id;

  // A nyertes jelölt `approved`, a duplikátumai `merged` — az utóbbiak a
  // létrejött deszkára mutatnak, így a figyelő többé nem hozza vissza őket.
  const { error: winnerError } = await client
    .from("catalog_candidates")
    .update({ status: "approved", reviewed_by: input.reviewerId, matched_board_id: boardId })
    .eq("id", input.candidateId)
    .eq("status", "pending");
  if (winnerError) return { ok: false, error: `jelölt frissítés: ${winnerError.message}` };

  if (input.mergedCandidateIds.length > 0) {
    const { error: mergedError } = await client
      .from("catalog_candidates")
      .update({ status: "merged", reviewed_by: input.reviewerId, matched_board_id: boardId })
      .in("id", [...input.mergedCandidateIds])
      .eq("status", "pending");
    if (mergedError) return { ok: false, error: `duplikátum frissítés: ${mergedError.message}` };
  }

  return { ok: true, boardId };
}

/**
 * Jelölt ÖSSZEFÉSÜLÉSE egy MÁR LÉTEZŐ katalógus-sorral — nem születik új deszka.
 *
 * MIÉRT KELL (élesben mért kockázat, 2026-08-20): a jelölt sora a crawl
 * pillanatában megfagy, benne az AKKORI egyeztetéssel. A bolti jelöltek jó
 * része KORÁBBAN keletkezett, mint a hozzá tartozó gyártói deszka, ezért
 * `matched_board_id` nélkül várakozik — a tömeges jóváhagyó pedig ezt „új
 * típusnak" látta volna, és a katalógusba került volna egy második „ATLAS",
 * „BEAST", „HYPER", „RAPID" és „Dhyana", bolti nevekkel
 * („MAGMA 11'2" 23%", „RAPID BT 22RP , 130kg ig").
 */
export async function mergeCandidateIntoBoard(
  client: SupabaseClient,
  input: { candidateId: string; boardId: string; reviewerId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from("catalog_candidates")
    .update({
      status: "merged",
      reviewed_by: input.reviewerId,
      matched_board_id: input.boardId,
    })
    .eq("id", input.candidateId)
    .eq("status", "pending");
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Márka feloldása/létrehozása — az app-oldali `resolveBrandId` párja. */
async function resolveBrandIdForApproval(
  client: SupabaseClient,
  name: string,
): Promise<string | null> {
  const { data: existing } = await client.from("brands").select("id").ilike("name", name).limit(1);
  const found = (existing as { id: string }[] | null)?.[0];
  if (found) return found.id;

  const { data, error } = await client.from("brands").insert({ name }).select("id").single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Ütközésmentes slug. SZÁNDÉKOSAN kind-AGNOSZTIKUS: a slug a TELJES `boards`
 * táblán belül egyedi (deszka és kiegészítő ugyanabból a sorhalmazból kap
 * URL-t), az app-oldali párjával (`candidates.server.ts`) egyezően.
 */
async function resolveUniqueSlugForApproval(client: SupabaseClient, base: string): Promise<string> {
  const root = base === "" ? "deszka" : base;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const { data } = await client
      .from("boards")
      // kind-AGNOSZTIKUS (szándékos): a slug a TELJES táblán belül egyedi.
      .select("id")
      .eq("slug->>hu", candidate)
      .limit(1);
    if (((data as unknown[] | null) ?? []).length === 0) return candidate;
  }
  return `${root}-${Date.now()}`;
}
