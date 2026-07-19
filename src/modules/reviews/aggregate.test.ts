import { describe, expect, it } from "vitest";

import { computeReviewAggregate, toTen } from "./aggregate";
import type { BoardReviewRow } from "./types";

function review(overrides: Partial<BoardReviewRow>): BoardReviewRow {
  return {
    id: crypto.randomUUID(),
    board_id: "board-1",
    user_id: crypto.randomUUID(),
    rating_overall: 5,
    rating_stability: 5,
    rating_glide: 4,
    rating_build: 4,
    rating_value: 3,
    text_pros: null,
    text_cons: null,
    used_water_type: "to",
    used_rider_weight_kg: null,
    used_experience: null,
    verified_owner: false,
    status: "published",
    created_at: "2026-07-19T10:00:00.000Z",
    updated_at: "2026-07-19T10:00:00.000Z",
    ...overrides,
  };
}

describe("computeReviewAggregate", () => {
  it("üres tömbre 0 count + null átlagok", () => {
    const agg = computeReviewAggregate([]);
    expect(agg.count).toBe(0);
    expect(agg.avgOverall).toBeNull();
    expect(agg.perDimension).toEqual({
      stability: null,
      glide: null,
      build: null,
      value: null,
    });
    expect(agg.percentRecommend).toBe(0);
    expect(agg.verifiedCount).toBe(0);
  });

  it("csak a publikált sorokat számolja (hidden/pending kizárva)", () => {
    const agg = computeReviewAggregate([
      review({ rating_overall: 5, status: "published" }),
      review({ rating_overall: 1, status: "hidden" }),
      review({ rating_overall: 1, status: "pending" }),
    ]);
    expect(agg.count).toBe(1);
    expect(agg.avgOverall).toBe(5);
  });

  it("átlagokat 1 tizedesre kerekít (4,55 → 4,6)", () => {
    const agg = computeReviewAggregate([
      review({ rating_overall: 5 }),
      review({ rating_overall: 4 }),
      review({ rating_overall: 5 }),
      review({ rating_overall: 4 }),
      review({ rating_overall: 5 }),
      review({ rating_overall: 5 }),
      review({ rating_overall: 4 }),
      review({ rating_overall: 5 }),
      review({ rating_overall: 5 }),
      review({ rating_overall: 4 }), // 46/10 = 4,6
    ]);
    expect(agg.avgOverall).toBe(4.6);
  });

  it("dimenzió-átlag null, ha az adott dimenzióra egy sorban sincs adat", () => {
    const agg = computeReviewAggregate([
      review({ rating_stability: null, rating_glide: 4, rating_build: null, rating_value: null }),
      review({ rating_stability: null, rating_glide: 2, rating_build: null, rating_value: null }),
    ]);
    expect(agg.perDimension.stability).toBeNull();
    expect(agg.perDimension.glide).toBe(3);
    expect(agg.perDimension.build).toBeNull();
  });

  it("percentRecommend = a >=4 összbenyomás aránya (egész %)", () => {
    const agg = computeReviewAggregate([
      review({ rating_overall: 5 }),
      review({ rating_overall: 4 }),
      review({ rating_overall: 3 }),
      review({ rating_overall: 2 }), // 2/4 = 50%
    ]);
    expect(agg.percentRecommend).toBe(50);
  });

  it("verifiedCount csak a publikált verified_owner sorokat számolja", () => {
    const agg = computeReviewAggregate([
      review({ verified_owner: true, status: "published" }),
      review({ verified_owner: true, status: "hidden" }),
      review({ verified_owner: false, status: "published" }),
    ]);
    expect(agg.verifiedCount).toBe(1);
  });
});

describe("toTen", () => {
  it("1–5 átlagot 10-es skálára vált, 1 tizedesre", () => {
    expect(toTen(4.6)).toBe(9.2);
    expect(toTen(3)).toBe(6);
    expect(toTen(null)).toBeNull();
  });
});
