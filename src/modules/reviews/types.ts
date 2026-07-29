/**
 * reviews sor-típusok (3.1 séma: board_reviews + review_flags). A ratingek
 * 1–5 skálán tárolódnak; a UI 10-es mércét rajzol (lásd aggregate.ts `toTen`).
 */

/** board_reviews.status CHECK-kényszere (3.1). */
export type ReviewStatus = "published" | "hidden" | "pending";

/** board_reviews.used_water_type CHECK-kényszere (3.1). */
export type UsedWaterType = "to" | "folyo" | "tenger";

export const USED_WATER_TYPES: readonly UsedWaterType[] = ["to", "folyo", "tenger"];

export function isUsedWaterType(value: unknown): value is UsedWaterType {
  return typeof value === "string" && (USED_WATER_TYPES as readonly string[]).includes(value);
}

/** review_flags.reason CHECK-kényszere (3.1). */
export type FlagReason = "spam" | "offensive" | "fake" | "other";

export const REVIEW_FLAG_REASONS: readonly FlagReason[] = ["spam", "offensive", "fake", "other"];

export function isFlagReason(value: unknown): value is FlagReason {
  return typeof value === "string" && (REVIEW_FLAG_REASONS as readonly string[]).includes(value);
}

/** `public.board_reviews` sor (3.1) — minden oszlop. */
export interface BoardReviewRow {
  id: string;
  board_id: string;
  user_id: string;
  rating_overall: number;
  rating_stability: number | null;
  rating_glide: number | null;
  rating_build: number | null;
  rating_value: number | null;
  text_pros: string | null;
  text_cons: string | null;
  used_water_type: UsedWaterType | null;
  used_rider_weight_kg: number | null;
  used_experience: string | null;
  /**
   * Explicit „ajánlom / nem ajánlom" (20260717092300 migráció). `null` = a
   * vélemény a bevezetés ELŐTTRŐL való — ilyenkor az aggregátor a régi
   * `rating_overall >= 4` származtatást használja, hogy a meglévő százalékok ne
   * torzuljanak visszamenőleg. Az űrlap és az aggregátor bekötése külön lépés.
   */
  would_recommend: boolean | null;
  /**
   * EGYELŐRE NEM HASZNÁLT (20260717092300 migráció): a jövőbeli
   * KATEGÓRIA-SPECIFIKUS szempontok tárolója, 1–5 skálán
   * (pl. `{"suly": 4, "merevseg": 5}`). A szabály: a négy `rating_*` oszlop
   * marad a DESZKA kanonikus tárolója, minden ÚJ szempont ide kerül.
   */
  ratings: Record<string, number> | null;
  verified_owner: boolean;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
}

/** `public.review_flags` sor (3.1). */
export interface ReviewFlagRow {
  id: string;
  review_id: string;
  flagged_by: string;
  reason: FlagReason;
  note: string | null;
  resolved: boolean;
  resolved_by: string | null;
  created_at: string;
}

/** A Közös nevező-dimenziók (a board_reviews rating_* oszlopaival egyezők). */
export type ReviewDimension = "stability" | "glide" | "build" | "value";

export const REVIEW_DIMENSIONS: readonly ReviewDimension[] = [
  "stability",
  "glide",
  "build",
  "value",
];

/**
 * Melyik célhoz mely dimenziók jelennek meg (F2.3 2. szakasz, terv 166. sor).
 * Deszkánál a mai 4 szempont; kiegészítőnél üres — a 4 deszka-oszlop (stability/
 * glide/build/value) egy evezőn vagy pumpán értelmetlen. ÚJ kategória-specifikus
 * szempont a jövőben a `ratings` jsonb-be kerül (lásd `BoardReviewRow.ratings`),
 * NEM új oszlopként — ez a függvény akkor bővül target-specifikus listával.
 */
export function getReviewDimensions(target: "board" | "accessory"): readonly ReviewDimension[] {
  return target === "board" ? REVIEW_DIMENSIONS : [];
}

/**
 * A publikált vélemények aggregátuma (Közös nevező-blokk). Az átlagok 1–5 skálán,
 * 1 tizedesre kerekítve; a 10-es mércéhez a `toTen` helper skáláz.
 */
export interface ReviewAggregate {
  count: number;
  /** Összesített átlag 1–5, null ha nincs publikált vélemény. */
  avgOverall: number | null;
  /** Dimenziónkénti átlag 1–5, null ha az adott dimenzióra nincs adat. */
  perDimension: Record<ReviewDimension, number | null>;
  /** rating_overall ≥ 4 aránya, egész %. */
  percentRecommend: number;
  /** verified_owner = true publikált vélemények száma. */
  verifiedCount: number;
}
