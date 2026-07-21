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

/**
 * Tiszta reduce-logika: boardonként a legolcsóbb `price_huf` (F1.6 Deszkaválasztó
 * ár-sáv szűrő/ár-érték pontszámhoz). Külön exportálva, hogy Supabase-mockolás
 * nélkül, önmagában tesztelhető legyen (a spots `pickLatestPerSpot` mintájára).
 */
export function pickCheapestPerBoard(
  rows: readonly Pick<BoardPriceRow, "board_id" | "price_huf">[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const current = map.get(row.board_id);
    if (current === undefined || row.price_huf < current) {
      map.set(row.board_id, row.price_huf);
    }
  }
  return map;
}

/** Minden `board_prices` sor egy queryben, boardonként a MIN `price_huf`-ra redukálva. */
export async function listCheapestPriceByBoard(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("board_prices").select("board_id, price_huf");
  if (error || !data) {
    return new Map();
  }
  return pickCheapestPerBoard(data as Pick<BoardPriceRow, "board_id" | "price_huf">[]);
}
