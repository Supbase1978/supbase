/**
 * catalog sor-típusok (3.1 séma). A `slug`/`description` fordítható jsonb
 * (Record<string,string>); a `geom`-hoz hasonló nyers reprezentációk itt nincsenek.
 */

/** boards.board_type CHECK-kényszerével egyező típusok (3.1). */
export type BoardType =
  | "allround"
  | "touring"
  | "race"
  | "yoga"
  | "kids"
  | "fishing"
  | "river";

export const BOARD_TYPES: readonly BoardType[] = [
  "allround",
  "touring",
  "race",
  "yoga",
  "kids",
  "fishing",
  "river",
];

/**
 * boards.status életciklus (catalog-watch migráció, docs/CATALOG_WATCH_TERV.md):
 * `active` · `discontinued` (kifutott, nem törlődik) · `unverified` (jelölt-eredetű).
 */
export type BoardStatus = "active" | "discontinued" | "unverified";

/** `public.brands` sor (3.1). */
export interface BrandRow {
  id: string;
  name: string;
  website_url: string | null;
}

/** `public.boards` sor (3.1) — minden oszlop. */
export interface BoardRow {
  id: string;
  brand_id: string;
  model_name: string;
  model_year: number | null;
  slug: Record<string, string>;
  board_type: BoardType;
  length_cm: number | null;
  width_cm: number | null;
  thickness_cm: number | null;
  volume_l: number | null;
  weight_kg: number | null;
  rider_weight_min_kg: number | null;
  rider_weight_max_kg: number | null;
  max_load_kg: number | null;
  inflatable: boolean;
  description: Record<string, string> | null;
  manual_url: string | null;
  image_url: string | null;
  availability_hu: boolean;
  /** Generált oszlop (3.1), csak olvasható. */
  stability_index: number | null;
  created_at: string;
  // catalog-watch életciklus-mezők (20260717091600 migráció) — a figyelő tölti.
  status: BoardStatus;
  first_seen_at: string;
  last_seen_at: string | null;
  discontinued_at: string | null;
}

/** boards + brand-join (PostgREST `brand:brands(*)`). */
export interface BoardWithBrand extends BoardRow {
  brand: BrandRow | null;
}

/**
 * `catalog_candidates.status` — a moderációs sor állapotai
 * (docs/CATALOG_WATCH_TERV.md 3. pont).
 */
export type CandidateStatus = "pending" | "approved" | "rejected" | "merged";

/** Deszka-specifikáció a jelöltből; `null` = a forrás nem árulta el. */
export interface ExtractedBoardSpecs {
  lengthCm: number | null;
  widthCm: number | null;
  thicknessCm: number | null;
  volumeL: number | null;
  weightKg: number | null;
  maxLoadKg: number | null;
  inflatable: boolean | null;
}

/**
 * A `catalog_candidates.extracted` jsonb SZERZŐDÉSE — ezt írja a figyelő
 * (`tools/catalog-watch`), és ezt olvassa a moderációs UI. A típus itt, a
 * catalog modulban él (a figyelő innen importálja), hogy a két oldal ne
 * csúszhasson el egymástól.
 */
export interface ExtractedBoardData {
  sourceUrl: string;
  brandName: string | null;
  modelName: string;
  /** A termékoldal nyers címe — a moderátor ezt látja az azonosításhoz. */
  rawTitle: string;
  modelYear: number | null;
  priceHuf: number | null;
  inStock: boolean | null;
  imageUrl: string | null;
  boardType: BoardType | null;
  specs: ExtractedBoardSpecs;
}

/** `public.catalog_candidates` sor (catalog-watch migráció). */
export interface CatalogCandidateRow {
  id: string;
  source_id: string;
  url: string | null;
  raw: unknown;
  extracted: ExtractedBoardData | null;
  matched_board_id: string | null;
  match_confidence: number | null;
  status: CandidateStatus;
  reviewed_by: string | null;
  created_at: string;
}

/** `public.board_prices` sor (3.1). */
export interface BoardPriceRow {
  id: string;
  board_id: string;
  shop_name: string;
  url: string | null;
  price_huf: number;
  recorded_at: string;
}
