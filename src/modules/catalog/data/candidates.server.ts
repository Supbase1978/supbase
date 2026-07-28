/**
 * catalog-watch moderáció — a jelölt-sor adatrétege (terv 3. pont).
 *
 * A klienst a hívó route adja át, mint a `boards.server.ts`-ben; a jogosultságot
 * az RLS kényszeríti ki (`catalog_candidates`: select ÉS write csak
 * moderator/admin), a route-réteg `requireRole` a védőháló.
 *
 * ITT SZÜLETIK MEG AZ ÚJ DESZKA. A figyelő szándékosan nem hozhat létre
 * `boards` sort — egy típus csak innen, moderátori döntésből kerülhet a
 * katalógusba. Ez a kapu védi ki, hogy ugyanaz a modell két néven duplán
 * jelenjen meg (terv: „az admin dolga egyetlen egyszerű jóváhagyás").
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { slugify } from "@core/text/slug";

import type {
  BoardType,
  CatalogCandidateRow,
  ExtractedBoardData,
  ExtractedBoardSpecs,
} from "../types";

/** Jelölt + a moderátornak szükséges környezet (forrás neve, javasolt pár). */
export interface CandidateWithContext {
  candidate: CatalogCandidateRow;
  sourceName: string | null;
  /** A `matched_board_id`-hoz tartozó deszka megnevezése (bizonytalan egyezésnél). */
  matchedBoardLabel: string | null;
}

export interface ModerationResult {
  ok: boolean;
  /** i18n-kulcs a hibához (nem kész mondat) — a route fordítja. */
  errorKey?: string;
}

/** Egy deszka rövid megnevezése a moderációs listákhoz. */
function boardLabel(row: { model_name: string; brand?: { name?: string } | null }): string {
  const brand = row.brand?.name;
  return brand ? `${brand} ${row.model_name}` : row.model_name;
}

/** A jóváhagyásra váró jelöltek, legfrissebb elöl. */
export async function listPendingCandidates(
  supabase: SupabaseClient,
): Promise<CandidateWithContext[]> {
  const { data, error } = await supabase
    .from("catalog_candidates")
    .select("*, source:catalog_sources(name), matched:boards(model_name, brand:brands(name))")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }

  return (data as unknown[]).map((row) => {
    const typed = row as CatalogCandidateRow & {
      source: { name: string } | null;
      matched: { model_name: string; brand: { name: string } | null } | null;
    };
    return {
      candidate: typed,
      sourceName: typed.source?.name ?? null,
      matchedBoardLabel: typed.matched ? boardLabel(typed.matched) : null,
    };
  });
}

/**
 * A jóváhagyáshoz felkínált deszkák (merge-célpontok). A teljes lista megy ki,
 * mert a katalógus kicsi; a moderátor a legördülőből választ.
 */
export async function listBoardChoices(
  supabase: SupabaseClient,
): Promise<{ id: string; label: string }[]> {
  const { data, error } = await supabase
    .from("boards")
    .select("id, model_name, brand:brands(name)")
    .order("model_name");
  if (error || !data) {
    return [];
  }
  return (data as unknown[]).map((row) => {
    const typed = row as { id: string; model_name: string; brand: { name: string } | null };
    return { id: typed.id, label: boardLabel(typed) };
  });
}

/**
 * Márka feloldása névből: meglévő sor (kis/nagybetű-független), különben ÚJ
 * márka. A figyelő ezt nem teheti meg — a márka-létrehozás is moderátori
 * döntés része (elgépelt márkanévből különben szemét-sor lenne).
 */
async function resolveBrandId(supabase: SupabaseClient, name: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("brands")
    .select("id")
    .ilike("name", name)
    .limit(1);
  const found = (existing as { id: string }[] | null)?.[0];
  if (found) {
    return found.id;
  }

  const { data, error } = await supabase
    .from("brands")
    .insert({ name })
    .select("id")
    .single();
  if (error || !data) {
    return null;
  }
  return (data as { id: string }).id;
}

/** Ütközésmentes slug: `-2`, `-3` … utótag, amíg szabad nem lesz. */
async function resolveUniqueSlug(supabase: SupabaseClient, base: string): Promise<string> {
  const root = base === "" ? "deszka" : base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const { data } = await supabase
      .from("boards")
      .select("id")
      .eq("slug->>hu", candidate)
      .limit(1);
    if (((data as unknown[] | null) ?? []).length === 0) {
      return candidate;
    }
  }
  return `${root}-${Date.now()}`;
}

/**
 * Tiszta leképezés: kinyert jelölt-adat → `boards` insert-payload.
 *
 * Külön exportálva, hogy Supabase-mock nélkül tesztelhető legyen (a modul
 * `pickCheapestPerBoard` mintája). Két tudatos döntés:
 *  * `status: "active"` — a jóváhagyás EMBERI döntés volt, nem gépi (a terv 3.
 *    pontja is aktív sorról ír); az `unverified` az átnézetlen tömeges importé.
 *  * a hiányzó spec-mezők `null`-ként mennek be: az adatlapon inkább hiányozzon
 *    egy méret, mint hogy találgatott értéket mutassunk.
 */
export function buildBoardInsert(
  extracted: ExtractedBoardData,
  options: { brandId: string; boardType: BoardType; slug: string; seenAt: string },
): Record<string, unknown> {
  const specs: ExtractedBoardSpecs = extracted.specs;
  return {
    brand_id: options.brandId,
    model_name: extracted.modelName === "" ? extracted.rawTitle : extracted.modelName,
    model_year: extracted.modelYear,
    slug: { hu: options.slug, en: options.slug },
    board_type: options.boardType,
    length_cm: specs.lengthCm === null ? null : Math.round(specs.lengthCm),
    width_cm: specs.widthCm === null ? null : Math.round(specs.widthCm),
    thickness_cm: specs.thicknessCm === null ? null : Math.round(specs.thicknessCm),
    volume_l: specs.volumeL === null ? null : Math.round(specs.volumeL),
    weight_kg: specs.weightKg,
    max_load_kg: specs.maxLoadKg === null ? null : Math.round(specs.maxLoadKg),
    inflatable: specs.inflatable ?? true,
    image_url: extracted.imageUrl,
    availability_hu: extracted.inStock ?? false,
    status: "active",
    first_seen_at: options.seenAt,
    last_seen_at: options.seenAt,
  };
}

async function loadPendingCandidate(
  supabase: SupabaseClient,
  candidateId: string,
): Promise<CatalogCandidateRow | null> {
  const { data, error } = await supabase
    .from("catalog_candidates")
    .select("*")
    .eq("id", candidateId)
    .eq("status", "pending")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as CatalogCandidateRow;
}

/** A jelölt bolti ára ársorként (a bolt neve = a forrás neve). */
async function recordCandidatePrice(
  supabase: SupabaseClient,
  boardId: string,
  extracted: ExtractedBoardData,
  shopName: string | null,
): Promise<void> {
  if (extracted.priceHuf === null) {
    return;
  }
  await supabase.from("board_prices").insert({
    board_id: boardId,
    shop_name: shopName ?? "catalog-watch",
    url: extracted.sourceUrl,
    price_huf: extracted.priceHuf,
  });
}

/**
 * JÓVÁHAGYÁS: a jelöltből ÚJ deszka lesz. A `boardType` a moderátoré — a
 * figyelő tippje csak előválasztás az űrlapon, mert a típus a Deszkaválasztó
 * cél-illesztését vezérli.
 */
export async function approveCandidate(
  supabase: SupabaseClient,
  input: { candidateId: string; boardType: BoardType; reviewerId: string },
): Promise<ModerationResult> {
  const candidate = await loadPendingCandidate(supabase, input.candidateId);
  if (!candidate?.extracted) {
    return { ok: false, errorKey: "admin.error.notFound" };
  }
  const extracted = candidate.extracted;

  if (!extracted.brandName) {
    return { ok: false, errorKey: "admin.error.noBrand" };
  }
  const brandId = await resolveBrandId(supabase, extracted.brandName);
  if (!brandId) {
    return { ok: false, errorKey: "admin.error.brandFailed" };
  }

  const seenAt = new Date().toISOString();
  const slug = await resolveUniqueSlug(
    supabase,
    slugify(`${extracted.brandName} ${extracted.modelName}`),
  );

  const { data, error } = await supabase
    .from("boards")
    .insert(buildBoardInsert(extracted, { brandId, boardType: input.boardType, slug, seenAt }))
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, errorKey: "admin.error.insertFailed" };
  }
  const boardId = (data as { id: string }).id;

  const { data: source } = await supabase
    .from("catalog_sources")
    .select("name")
    .eq("id", candidate.source_id)
    .maybeSingle();
  await recordCandidatePrice(
    supabase,
    boardId,
    extracted,
    (source as { name: string } | null)?.name ?? null,
  );

  const { error: updateError } = await supabase
    .from("catalog_candidates")
    .update({ status: "approved", reviewed_by: input.reviewerId, matched_board_id: boardId })
    .eq("id", input.candidateId);
  return updateError ? { ok: false, errorKey: "admin.error.updateFailed" } : { ok: true };
}

/**
 * ÖSSZEFÉSÜLÉS: a jelölt egy MÁR MEGLÉVŐ deszka bolti listingje. Új sor nem
 * születik, csak ársor + „láttuk" jelzés — ez a dupla-név elleni védelem.
 */
export async function mergeCandidate(
  supabase: SupabaseClient,
  input: { candidateId: string; boardId: string; reviewerId: string },
): Promise<ModerationResult> {
  const candidate = await loadPendingCandidate(supabase, input.candidateId);
  if (!candidate?.extracted) {
    return { ok: false, errorKey: "admin.error.notFound" };
  }
  const extracted = candidate.extracted;

  const patch: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
  if (extracted.inStock !== null) {
    patch.availability_hu = extracted.inStock;
  }
  const { error: boardError } = await supabase
    .from("boards")
    .update(patch)
    .eq("id", input.boardId);
  if (boardError) {
    return { ok: false, errorKey: "admin.error.updateFailed" };
  }

  const { data: source } = await supabase
    .from("catalog_sources")
    .select("name")
    .eq("id", candidate.source_id)
    .maybeSingle();
  await recordCandidatePrice(
    supabase,
    input.boardId,
    extracted,
    (source as { name: string } | null)?.name ?? null,
  );

  const { error } = await supabase
    .from("catalog_candidates")
    .update({
      status: "merged",
      reviewed_by: input.reviewerId,
      matched_board_id: input.boardId,
    })
    .eq("id", input.candidateId);
  return error ? { ok: false, errorKey: "admin.error.updateFailed" } : { ok: true };
}

/**
 * ELUTASÍTÁS. A sor megmarad `rejected` státusszal: a figyelő ebből tudja, hogy
 * ezt az URL-t nem kell újra a sorba tennie (store.saveCandidate).
 */
export async function rejectCandidate(
  supabase: SupabaseClient,
  input: { candidateId: string; reviewerId: string },
): Promise<ModerationResult> {
  const { error } = await supabase
    .from("catalog_candidates")
    .update({ status: "rejected", reviewed_by: input.reviewerId })
    .eq("id", input.candidateId)
    .eq("status", "pending");
  return error ? { ok: false, errorKey: "admin.error.updateFailed" } : { ok: true };
}

/** Az életciklus-vizsgálathoz: minden deszka, kevés oszloppal. */
export async function listBoardsForLifecycle(supabase: SupabaseClient): Promise<
  {
    id: string;
    modelName: string;
    status: string;
    last_seen_at: string | null;
    availability_hu: boolean;
  }[]
> {
  const { data, error } = await supabase
    .from("boards")
    .select("id, model_name, status, last_seen_at, availability_hu, brand:brands(name)");
  if (error || !data) {
    return [];
  }
  return (data as unknown[]).map((row) => {
    const typed = row as {
      id: string;
      model_name: string;
      status: string;
      last_seen_at: string | null;
      availability_hu: boolean;
      brand: { name: string } | null;
    };
    return {
      id: typed.id,
      modelName: boardLabel({ model_name: typed.model_name, brand: typed.brand }),
      status: typed.status,
      last_seen_at: typed.last_seen_at,
      availability_hu: typed.availability_hu,
    };
  });
}

/**
 * KIFUTÁS megerősítése — ezt is EMBER dönti el (a figyelő csak jelöl). A sor
 * NEM törlődik: a vélemények és a Deszkaválasztó-történet megmarad, az adatlap
 * pedig „már nem kapható" jelzést mutathat.
 */
export async function setBoardDiscontinued(
  supabase: SupabaseClient,
  boardId: string,
  discontinued: boolean,
): Promise<ModerationResult> {
  const { error } = await supabase
    .from("boards")
    .update(
      discontinued
        ? { status: "discontinued", discontinued_at: new Date().toISOString(), availability_hu: false }
        : { status: "active", discontinued_at: null },
    )
    .eq("id", boardId);
  return error ? { ok: false, errorKey: "admin.error.updateFailed" } : { ok: true };
}
