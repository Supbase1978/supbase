/**
 * catalog sor-típusok (3.1 séma). A `slug`/`description` fordítható jsonb
 * (Record<string,string>); a `geom`-hoz hasonló nyers reprezentációk itt nincsenek.
 */
import type { GearCategory } from "./gear";

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

/**
 * `boards.kind` diszkriminátor (20260717092200 migráció): a tábla a deszkák
 * MELLETT a felszerelés-sorokat is hordozza. A `boards_kind_shape` CHECK tartja
 * be, hogy a két alak ne keveredjen — a TS-oldali párja a `CatalogItemRow`
 * diszkriminált unió.
 */
export type BoardKind = "board" | "accessory";

/** `public.brands` sor (3.1). */
export interface BrandRow {
  id: string;
  name: string;
  website_url: string | null;
}

/** A `boards` tábla KIND-FÜGGETLEN oszlopai (deszka és kiegészítő közös része). */
export interface CatalogItemRowBase {
  id: string;
  brand_id: string;
  model_name: string;
  model_year: number | null;
  slug: Record<string, string>;
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

/**
 * `public.boards` DESZKA-sor (`kind = 'board'`) — minden oszlop.
 *
 * A `board_type` itt SZÁNDÉKOSAN nem-null, noha az oszlop az adatbázisban már
 * nullable: a `boards_kind_shape` CHECK garantálja, hogy deszka-soron mindig
 * van típus. Ez a típus tehát csak `kind='board'`-ra szűrt lekérdezés
 * eredményére igaz — épp ez a szűrés a korrektségi invariáns (a Deszkaválasztó
 * SOHA nem kaphat kiegészítőt).
 */
export interface BoardRow extends CatalogItemRowBase {
  kind: "board";
  board_type: BoardType;
  accessory_type: null;
}

/** `public.boards` FELSZERELÉS-sor (`kind = 'accessory'`) — minden oszlop. */
export interface AccessoryRow extends CatalogItemRowBase {
  kind: "accessory";
  board_type: null;
  /** A `GEAR_CATEGORIES` zárt listája (gear.ts) = az oszlop CHECK-kényszere. */
  accessory_type: GearCategory;
}

/**
 * A `boards` tábla bármelyik sora, DISZKRIMINÁLT unióként — a `kind` mezőre
 * szűkítve a TS is kikényszeríti az alak-kényszert (kiegészítőn nincs
 * `board_type`, deszkán nincs `accessory_type`).
 */
export type CatalogItemRow = BoardRow | AccessoryRow;

/** deszka + brand-join (PostgREST `brand:brands(*)`). */
export interface BoardWithBrand extends BoardRow {
  brand: BrandRow | null;
}

/** kiegészítő + brand-join (PostgREST `brand:brands(*)`). */
export interface AccessoryWithBrand extends AccessoryRow {
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
  /**
   * Felszerelés-kategória, ha a figyelő `classifyProduct` döntése `accessory`
   * (F2.3 3. szakasz) — deszka-jelöltnél MINDIG `null`. A moderációs UI ez
   * alapján dönti el, melyik jóváhagyó űrlapot (deszka vagy kiegészítő) mutassa.
   */
  accessoryType: GearCategory | null;
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
