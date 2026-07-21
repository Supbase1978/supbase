import { describe, expect, it } from "vitest";

import {
  ADVISOR_KEYS,
  DEFAULT_ADVISOR_CONFIG,
  parseAdvisorConfig,
  type AdvisorWeightRow,
} from "./config";

describe("parseAdvisorConfig", () => {
  it("null/undefined sorok → tiszta default (fail-safe)", () => {
    expect(parseAdvisorConfig(null)).toEqual(DEFAULT_ADVISOR_CONFIG);
    expect(parseAdvisorConfig(undefined)).toEqual(DEFAULT_ADVISOR_CONFIG);
  });

  it("üres tömb → default", () => {
    expect(parseAdvisorConfig([])).toEqual(DEFAULT_ADVISOR_CONFIG);
  });

  it("a seed advisor.* sorai visszaadják a DEFAULT_ADVISOR_CONFIG-ot", () => {
    // Pontosan a supabase/seed.sql 312–324. sora (advisor.* kulcsok).
    const seeded: AdvisorWeightRow[] = [
      { key: "advisor.weight.stability", value: 30 },
      { key: "advisor.weight.reviews", value: 25 },
      { key: "advisor.weight.value", value: 20 },
      { key: "advisor.weight.purpose_fit", value: 15 },
      { key: "advisor.weight.availability", value: 10 },
      { key: "advisor.volume_multiplier.kezdo", value: 2.5 },
      { key: "advisor.volume_multiplier.halado", value: 2.2 },
      { key: "advisor.volume_multiplier.versenyzo", value: 2.0 },
      { key: "advisor.passenger.child_kg", value: 15 },
      { key: "advisor.passenger.dog_kg", value: 25 },
      { key: "advisor.max_load.safety_factor", value: 0.66 },
      { key: "advisor.reviews.min_count", value: 5 },
    ];
    expect(parseAdvisorConfig(seeded)).toEqual(DEFAULT_ADVISOR_CONFIG);
  });

  it("hangolt érték felülírja a defaultot (súly + skalár)", () => {
    const cfg = parseAdvisorConfig([
      { key: "advisor.weight.stability", value: 40 },
      { key: "advisor.max_load.safety_factor", value: 0.7 },
      { key: "advisor.reviews.min_count", value: 8 },
    ]);
    expect(cfg.weights.stability).toBe(40);
    expect(cfg.maxLoadSafetyFactor).toBe(0.7);
    expect(cfg.reviewsMinCount).toBe(8);
    // a többi default marad
    expect(cfg.weights.reviews).toBe(DEFAULT_ADVISOR_CONFIG.weights.reviews);
    expect(cfg.volumeMultiplier.kezdo).toBe(2.5);
  });

  it("hiányzó kulcs → default-fallback marad", () => {
    const cfg = parseAdvisorConfig([{ key: "advisor.weight.value", value: 22 }]);
    expect(cfg.weights.value).toBe(22);
    expect(cfg.maxLoadSafetyFactor).toBe(DEFAULT_ADVISOR_CONFIG.maxLoadSafetyFactor);
    expect(cfg.reviewsMinCount).toBe(DEFAULT_ADVISOR_CONFIG.reviewsMinCount);
  });

  it("string numerikus érték parse-olódik", () => {
    const cfg = parseAdvisorConfig([{ key: "advisor.reviews.min_count", value: "6" }]);
    expect(cfg.reviewsMinCount).toBe(6);
  });

  it("nem szám / NaN érték → default marad", () => {
    const cfg = parseAdvisorConfig([
      { key: "advisor.max_load.safety_factor", value: "nem-szam" },
    ]);
    expect(cfg.maxLoadSafetyFactor).toBe(DEFAULT_ADVISOR_CONFIG.maxLoadSafetyFactor);
  });

  it("ismeretlen (supindex.*) kulcsot figyelmen kívül hagy", () => {
    const cfg = parseAdvisorConfig([{ key: "supindex.wind.band1_max", value: 99 }]);
    expect(cfg).toEqual(DEFAULT_ADVISOR_CONFIG);
  });

  it("minden ADVISOR_KEYS-mező felülírható (leképezés-lefedettség)", () => {
    const rows: AdvisorWeightRow[] = Object.keys(ADVISOR_KEYS).map((key) => ({
      key,
      value: 42,
    }));
    const cfg = parseAdvisorConfig(rows);
    for (const path of Object.values(ADVISOR_KEYS)) {
      const group = path[0];
      const field = path[1];
      if (field === undefined) {
        expect((cfg as unknown as Record<string, number>)[group]).toBe(42);
      } else {
        expect((cfg[group as "weights" | "volumeMultiplier" | "passenger"] as Record<string, number>)[field]).toBe(42);
      }
    }
  });
});
