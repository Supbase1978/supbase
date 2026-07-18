import { describe, expect, it } from "vitest";

import {
  DEFAULT_SUPINDEX_CONFIG,
  parseSupIndexConfig,
  SUPINDEX_KEYS,
  type AdvisorWeightRow,
} from "./config";

describe("parseSupIndexConfig", () => {
  it("null/undefined sorok → tiszta default (fail-safe)", () => {
    expect(parseSupIndexConfig(null)).toEqual(DEFAULT_SUPINDEX_CONFIG);
    expect(parseSupIndexConfig(undefined)).toEqual(DEFAULT_SUPINDEX_CONFIG);
  });

  it("üres tömb → default", () => {
    expect(parseSupIndexConfig([])).toEqual(DEFAULT_SUPINDEX_CONFIG);
  });

  it("a seed-defaultok visszaadják a DEFAULT_SUPINDEX_CONFIG-ot", () => {
    // A seedben ténylegesen jelenlévő 20 kulcs (sector_deg és river nélkül).
    const seeded: AdvisorWeightRow[] = [
      { key: "supindex.wind.band1_max", value: 12 },
      { key: "supindex.wind.band2_max", value: 20 },
      { key: "supindex.wind.band3_max", value: 28 },
      { key: "supindex.wind.band4_max", value: 38 },
      { key: "supindex.wind.score.band1", value: 10 },
      { key: "supindex.wind.score.band2", value: 8 },
      { key: "supindex.wind.score.band3", value: 5 },
      { key: "supindex.wind.score.band4", value: 2 },
      { key: "supindex.wind.score.band5", value: 0 },
      { key: "supindex.gust.delta_threshold", value: 15 },
      { key: "supindex.gust.penalty", value: 2 },
      { key: "supindex.offshore.multiplier", value: 0.5 },
      { key: "supindex.offshore.wind_min", value: 15 },
      { key: "supindex.coldwater.temp_c", value: 14 },
      { key: "supindex.coldwater.penalty", value: 1.5 },
      { key: "supindex.storm.level1_cap", value: 3.9 },
      { key: "supindex.storm.level2_cap", value: 0 },
      { key: "supindex.threshold.excellent", value: 7 },
      { key: "supindex.threshold.caution", value: 4 },
    ];
    // A hiányzó sector_deg/river a default-fallbackból marad.
    expect(parseSupIndexConfig(seeded)).toEqual(DEFAULT_SUPINDEX_CONFIG);
  });

  it("hangolt érték felülírja a defaultot", () => {
    const cfg = parseSupIndexConfig([
      { key: "supindex.storm.level1_cap", value: 2.5 },
      { key: "supindex.offshore.multiplier", value: 0.3 },
    ]);
    expect(cfg.storm.level1Cap).toBe(2.5);
    expect(cfg.offshore.multiplier).toBe(0.3);
    // a többi default marad
    expect(cfg.wind.band1Max).toBe(DEFAULT_SUPINDEX_CONFIG.wind.band1Max);
  });

  it("string numerikus érték parse-olódik", () => {
    const cfg = parseSupIndexConfig([{ key: "supindex.gust.penalty", value: "3" }]);
    expect(cfg.gust.penalty).toBe(3);
  });

  it("nem szám / NaN érték → default marad", () => {
    const cfg = parseSupIndexConfig([{ key: "supindex.gust.penalty", value: "nem-szam" }]);
    expect(cfg.gust.penalty).toBe(DEFAULT_SUPINDEX_CONFIG.gust.penalty);
  });

  it("ismeretlen kulcsot figyelmen kívül hagy", () => {
    const cfg = parseSupIndexConfig([{ key: "advisor.weight.stability", value: 99 }]);
    expect(cfg).toEqual(DEFAULT_SUPINDEX_CONFIG);
  });

  it("minden SUPINDEX_KEYS-mező felülírható (leképezés-lefedettség)", () => {
    const rows: AdvisorWeightRow[] = Object.keys(SUPINDEX_KEYS).map((key) => ({
      key,
      value: 42,
    }));
    const cfg = parseSupIndexConfig(rows);
    for (const [group, field] of Object.values(SUPINDEX_KEYS)) {
      expect((cfg[group] as Record<string, number>)[field]).toBe(42);
    }
  });
});
