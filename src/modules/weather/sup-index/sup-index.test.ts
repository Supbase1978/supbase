import { describe, expect, it } from "vitest";

import { DEFAULT_SUPINDEX_CONFIG, type SupIndexConfig } from "./config";
import {
  angularDelta,
  computeSupIndex,
  isOffshoreWind,
  REASON_KEYS,
} from "./sup-index";
import type { SupIndexInput } from "./types";

/** Nyugodt alapeset: nincs vihar, tó, langyos víz, nincs part-tájolás. */
function base(overrides: Partial<SupIndexInput> = {}): SupIndexInput {
  return {
    wind_kmh: 5,
    gust_kmh: 5,
    wind_dir_deg: 0,
    water_temp_c: 20,
    storm_level: 0,
    shore_bearing_deg: null,
    water_type: "to",
    ...overrides,
  };
}

describe("angularDelta", () => {
  it.each([
    [0, 0, 0],
    [10, 350, 20],
    [200, 200, 0],
    [200, 245, 45],
    [200, 246, 46],
    [0, 180, 180],
    [350, 10, 20],
  ])("angularDelta(%i, %i) = %i", (a, b, expected) => {
    expect(angularDelta(a, b)).toBeCloseTo(expected);
  });
});

describe("computeSupIndex — határeset-tábla (default konfig)", () => {
  interface Case {
    name: string;
    input: SupIndexInput;
    index: number;
    status: "safe" | "caution" | "danger";
    offshoreWind?: boolean;
    neoprene?: boolean;
    stormLevel?: 0 | 1 | 2;
    reasonKey: string;
  }

  const cases: Case[] = [
    // --- 1) VIHARFOK-OVERRIDE ---
    {
      name: "storm_level=2 override → index 0 (mindent visz, még szélcsendben is)",
      input: base({ wind_kmh: 5, gust_kmh: 5, storm_level: 2 }),
      index: 0,
      status: "danger",
      stormLevel: 2,
      reasonKey: REASON_KEYS.storm2,
    },
    {
      name: "storm_level=1 plafon pontosan 3,9 (kellemes szél ellenére)",
      input: base({ wind_kmh: 5, gust_kmh: 5, storm_level: 1 }),
      index: 3.9,
      status: "danger",
      stormLevel: 1,
      reasonKey: REASON_KEYS.storm1,
    },
    {
      name: "storm_level=1 plafon alá is mehet (erős szél → 0)",
      input: base({ wind_kmh: 40, gust_kmh: 40, storm_level: 1 }),
      index: 0,
      status: "danger",
      stormLevel: 1,
      reasonKey: REASON_KEYS.storm1,
    },

    // --- 2) SZÉL-ALAPSÁVOK (határok 12/20/28/38) ---
    { name: "szél 12 (band1 felső) → 10", input: base({ wind_kmh: 12, gust_kmh: 12 }), index: 10, status: "safe", reasonKey: REASON_KEYS.good },
    { name: "szél 12,1 → band2 = 8", input: base({ wind_kmh: 12.1, gust_kmh: 12.1 }), index: 8, status: "safe", reasonKey: REASON_KEYS.good },
    { name: "szél 20 (band2 felső) → 8", input: base({ wind_kmh: 20, gust_kmh: 20 }), index: 8, status: "safe", reasonKey: REASON_KEYS.good },
    { name: "szél 20,1 → band3 = 5", input: base({ wind_kmh: 20.1, gust_kmh: 20.1 }), index: 5, status: "caution", reasonKey: REASON_KEYS.moderateWind },
    { name: "szél 28 (band3 felső) → 5", input: base({ wind_kmh: 28, gust_kmh: 28 }), index: 5, status: "caution", reasonKey: REASON_KEYS.moderateWind },
    { name: "szél 28,1 → band4 = 2", input: base({ wind_kmh: 28.1, gust_kmh: 28.1 }), index: 2, status: "danger", reasonKey: REASON_KEYS.strongWind },
    { name: "szél 38 (band4 felső) → 2", input: base({ wind_kmh: 38, gust_kmh: 38 }), index: 2, status: "danger", reasonKey: REASON_KEYS.strongWind },
    { name: "szél 38,1 → band5 = 0", input: base({ wind_kmh: 38.1, gust_kmh: 38.1 }), index: 0, status: "danger", reasonKey: REASON_KEYS.strongWind },

    // --- 3) LÖKÉS-BÜNTETÉS (gust − wind > 15) ---
    {
      name: "lökés-delta pontosan 15 → NINCS büntetés",
      input: base({ wind_kmh: 10, gust_kmh: 25 }),
      index: 10,
      status: "safe",
      reasonKey: REASON_KEYS.good,
    },
    {
      name: "lökés-delta 15,1 → −2 büntetés",
      input: base({ wind_kmh: 10, gust_kmh: 25.1 }),
      index: 8,
      status: "safe",
      reasonKey: REASON_KEYS.good,
    },

    // --- 4) OFFSHORE (besodró) SZORZÓ + szél pont 15 ---
    {
      name: "offshore szektorban, de szél pontosan 15 (nem > 15) → NINCS szorzó/flag",
      input: base({ wind_kmh: 15, gust_kmh: 15, wind_dir_deg: 200, shore_bearing_deg: 200 }),
      index: 8,
      status: "safe",
      offshoreWind: false,
      reasonKey: REASON_KEYS.good,
    },
    {
      name: "offshore szektorban, szél 15,1 → ×0,5 + besodró flag",
      input: base({ wind_kmh: 15.1, gust_kmh: 15.1, wind_dir_deg: 200, shore_bearing_deg: 200 }),
      index: 4,
      status: "caution",
      offshoreWind: true,
      reasonKey: REASON_KEYS.offshore,
    },
    {
      name: "szektor széle: delta pontosan 45° + szél 16 → offshore",
      input: base({ wind_kmh: 16, gust_kmh: 16, wind_dir_deg: 245, shore_bearing_deg: 200 }),
      index: 4,
      status: "caution",
      offshoreWind: true,
      reasonKey: REASON_KEYS.offshore,
    },
    {
      name: "szektoron kívül: delta 46° → parti szél, nincs szorzó",
      input: base({ wind_kmh: 16, gust_kmh: 16, wind_dir_deg: 246, shore_bearing_deg: 200 }),
      index: 8,
      status: "safe",
      offshoreWind: false,
      reasonKey: REASON_KEYS.good,
    },
    {
      name: "shore_bearing null → nincs offshore-számítás, erős szél ellenére sem",
      input: base({ wind_kmh: 25, gust_kmh: 25, wind_dir_deg: 200, shore_bearing_deg: null }),
      index: 5,
      status: "caution",
      offshoreWind: false,
      reasonKey: REASON_KEYS.moderateWind,
    },

    // --- 5) HIDEGVÍZ-KÜSZÖB (14 °C) ---
    {
      name: "víz pontosan 14 °C → NINCS büntetés/neoprén",
      input: base({ wind_kmh: 5, gust_kmh: 5, water_temp_c: 14 }),
      index: 10,
      status: "safe",
      neoprene: false,
      reasonKey: REASON_KEYS.good,
    },
    {
      name: "víz 13,9 °C → −1,5 + neoprén-flag",
      input: base({ wind_kmh: 5, gust_kmh: 5, water_temp_c: 13.9 }),
      index: 8.5,
      status: "safe",
      neoprene: true,
      reasonKey: REASON_KEYS.cold,
    },
    {
      name: "víz null → nincs hidegvíz-büntetés",
      input: base({ wind_kmh: 5, gust_kmh: 5, water_temp_c: null }),
      index: 10,
      status: "safe",
      neoprene: false,
      reasonKey: REASON_KEYS.good,
    },

    // --- 6) FOLYÓ-KORREKCIÓ ---
    {
      name: "folyó → konfigból −1 korrekció (10 → 9)",
      input: base({ wind_kmh: 5, gust_kmh: 5, water_type: "folyo" }),
      index: 9,
      status: "safe",
      reasonKey: REASON_KEYS.good,
    },

    // --- 7) STÁTUSZ-HATÁROK (pont 7,0 és pont 4,0) ---
    {
      name: "index pontosan 7,0 → safe (folyó, szél 20: 8 − 1)",
      input: base({ wind_kmh: 20, gust_kmh: 20, water_type: "folyo" }),
      index: 7,
      status: "safe",
      reasonKey: REASON_KEYS.good,
    },
    {
      name: "index pontosan 4,0 → caution (offshore 8 ×0,5)",
      input: base({ wind_kmh: 16, gust_kmh: 16, wind_dir_deg: 200, shore_bearing_deg: 200 }),
      index: 4,
      status: "caution",
      offshoreWind: true,
      reasonKey: REASON_KEYS.offshore,
    },
  ];

  it.each(cases)("$name", (c) => {
    const result = computeSupIndex(c.input);
    expect(result.index).toBeCloseTo(c.index);
    expect(result.status).toBe(c.status);
    expect(result.reason.key).toBe(c.reasonKey);
    if (c.offshoreWind !== undefined) {
      expect(result.flags.offshoreWind).toBe(c.offshoreWind);
    }
    if (c.neoprene !== undefined) {
      expect(result.flags.neoprene).toBe(c.neoprene);
    }
    expect(result.flags.stormLevel).toBe(c.stormLevel ?? 0);
  });
});

describe("computeSupIndex — kombinált / kimenet-formátum", () => {
  it("index sosem esik 0 alá és 10 fölé", () => {
    const stormy = computeSupIndex(base({ wind_kmh: 40, gust_kmh: 80, water_temp_c: 2 }));
    expect(stormy.index).toBeGreaterThanOrEqual(0);
    const calm = computeSupIndex(base({ wind_kmh: 1, gust_kmh: 1 }));
    expect(calm.index).toBeLessThanOrEqual(10);
  });

  it("egy tizedesre kerekít (fél felfelé): 8,25 → 8,3", () => {
    const cfg: SupIndexConfig = {
      ...DEFAULT_SUPINDEX_CONFIG,
      wind: { ...DEFAULT_SUPINDEX_CONFIG.wind, scoreBand1: 8.25 },
    };
    const result = computeSupIndex(base({ wind_kmh: 5, gust_kmh: 5 }), cfg);
    expect(result.index).toBe(8.3);
  });

  it("offshore szorzó a lökés-büntetés UTÁN hat (sorrend-érzékeny)", () => {
    // wind 16 → band2 8; gust delta 20 → −2 = 6; offshore ×0,5 = 3,0 → danger
    const result = computeSupIndex(
      base({ wind_kmh: 16, gust_kmh: 36, wind_dir_deg: 200, shore_bearing_deg: 200 }),
    );
    expect(result.index).toBeCloseTo(3);
    expect(result.status).toBe("danger");
    expect(result.flags.offshoreWind).toBe(true);
    // offshore prioritás a strongWind felett
    expect(result.reason.key).toBe(REASON_KEYS.offshore);
  });

  it("neoprén-indoklás, ha hideg de egyébként safe", () => {
    const result = computeSupIndex(base({ wind_kmh: 5, gust_kmh: 5, water_temp_c: 12 }));
    expect(result.reason.key).toBe(REASON_KEYS.cold);
    expect(result.reason.params.temp).toBe(12);
  });
});

describe("isOffshoreWind", () => {
  it("null bearing → soha nem offshore", () => {
    expect(
      isOffshoreWind(
        { wind_kmh: 30, wind_dir_deg: 200, shore_bearing_deg: null },
        DEFAULT_SUPINDEX_CONFIG.offshore,
      ),
    ).toBe(false);
  });

  it("szél pont a windMin-en (15) → nem offshore (szigorú >)", () => {
    expect(
      isOffshoreWind(
        { wind_kmh: 15, wind_dir_deg: 200, shore_bearing_deg: 200 },
        DEFAULT_SUPINDEX_CONFIG.offshore,
      ),
    ).toBe(false);
  });
});
