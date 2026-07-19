/**
 * Tiszta Népítélet-aggregátor (3.1 board_reviews → ReviewAggregate). Csak a
 * `status === 'published'` sorokat számolja; mellékhatás-mentes és injektált
 * bemeneten dolgozik → Supabase nélkül tesztelhető.
 */
import {
  REVIEW_DIMENSIONS,
  type BoardReviewRow,
  type ReviewAggregate,
  type ReviewDimension,
} from "./types";

/** A `rating_*` oszlop kiválasztása dimenzió szerint. */
const DIMENSION_COLUMN: Record<ReviewDimension, keyof BoardReviewRow> = {
  stability: "rating_stability",
  glide: "rating_glide",
  build: "rating_build",
  value: "rating_value",
};

/** Kerekítés 1 tizedesre (a megjelenítendő átlagokhoz). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Nem-null számok átlaga 1 tizedesre, vagy null ha nincs adat. */
function averageOrNull(values: readonly (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) {
    return null;
  }
  return round1(nums.reduce((sum, v) => sum + v, 0) / nums.length);
}

/** 1–5 skálájú átlag → 10-es mérce-érték (1 tizedes). null → null. */
export function toTen(avg1to5: number | null): number | null {
  return avg1to5 === null ? null : round1(avg1to5 * 2);
}

export function computeReviewAggregate(rows: readonly BoardReviewRow[]): ReviewAggregate {
  const published = rows.filter((r) => r.status === "published");
  const count = published.length;

  if (count === 0) {
    return {
      count: 0,
      avgOverall: null,
      perDimension: { stability: null, glide: null, build: null, value: null },
      percentRecommend: 0,
      verifiedCount: 0,
    };
  }

  const avgOverall = averageOrNull(published.map((r) => r.rating_overall));

  const perDimension = Object.fromEntries(
    REVIEW_DIMENSIONS.map((dim) => [
      dim,
      averageOrNull(published.map((r) => r[DIMENSION_COLUMN[dim]] as number | null)),
    ]),
  ) as Record<ReviewDimension, number | null>;

  const recommendCount = published.filter((r) => r.rating_overall >= 4).length;
  const percentRecommend = Math.round((recommendCount / count) * 100);

  const verifiedCount = published.filter((r) => r.verified_owner).length;

  return { count, avgOverall, perDimension, percentRecommend, verifiedCount };
}
