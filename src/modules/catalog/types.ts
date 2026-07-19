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
}

/** boards + brand-join (PostgREST `brand:brands(*)`). */
export interface BoardWithBrand extends BoardRow {
  brand: BrandRow | null;
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
