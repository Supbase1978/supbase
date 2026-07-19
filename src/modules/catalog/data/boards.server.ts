/**
 * catalog Supabase-lekérdezők (3.1 séma). A klienst a hívó (route-loader) adja
 * át PARAMÉTERKÉNT — a modul nem gyárt/importál szerver-klienst; azt kizárólag
 * az app/routes/deszkak*.tsx route-fájlok hívják (lásd module.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { BoardPriceRow, BoardWithBrand } from "../types";

/** Slug-alak: kisbetű/szám/kötőjel — minden seed-slug ilyen (3.1 jsonb slug). */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function listBoards(supabase: SupabaseClient): Promise<BoardWithBrand[]> {
  const { data, error } = await supabase
    .from("boards")
    .select("*, brand:brands(*)")
    .order("model_name", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data as unknown as BoardWithBrand[];
}

/**
 * Egy deszka slug szerint — a `slug` jsonb `hu` VAGY `en` kulcsa egyezhet.
 * A slug URL-paraméter és nyersen kerül a PostgREST `.or()` szűrő-stringbe: az
 * alak-ellenőrzés kizárja a szűrő-injektálást (vessző/zárójel/operátor).
 * Nincs találat → `null` (a hívó 404-et dob).
 */
export async function getBoardBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<BoardWithBrand | null> {
  if (!SLUG_PATTERN.test(slug)) {
    return null;
  }
  const { data, error } = await supabase
    .from("boards")
    .select("*, brand:brands(*)")
    .or(`slug->>hu.eq.${slug},slug->>en.eq.${slug}`)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as unknown as BoardWithBrand;
}

/** Egy deszka bolti árai, legolcsóbb elöl (ár-sávos „X e Ft-tól" megjelenítéshez). */
export async function listBoardPrices(
  supabase: SupabaseClient,
  boardId: string,
): Promise<BoardPriceRow[]> {
  const { data, error } = await supabase
    .from("board_prices")
    .select("*")
    .eq("board_id", boardId)
    .order("price_huf", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data as BoardPriceRow[];
}
