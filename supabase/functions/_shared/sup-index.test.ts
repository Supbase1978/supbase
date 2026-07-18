/**
 * SUP-index (_shared port) — a webes referenciával AZONOS szemantika ellenőrzése,
 * a kritikus határesetekre (5.1). A teljes táblázatos suite a webes modulban él
 * (src/modules/weather/sup-index); itt a port-egyenértékűséget és a konfig-olvasót
 * fedjük, hogy az Edge Function ugyanazt számolja.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SUPINDEX_CONFIG,
  computeSupIndex,
  isOffshoreWind,
  parseSupIndexConfig,
} from "./sup-index.ts";
import type { SupIndexInput } from "./types.ts";

const base: SupIndexInput = {
  wind_kmh: 10,
  gust_kmh: 12,
  wind_dir_deg: 0,
  water_temp_c: 20,
  storm_level: 0,
  shore_bearing_deg: null,
  water_type: "to",
};

describe("computeSupIndex — storm-override", () => {
  it("II. fok → fix 0, minden más felülírva", () => {
    const r = computeSupIndex({ ...base, wind_kmh: 5, storm_level: 2 });
    expect(r.index).toBe(0);
    expect(r.status).toBe("danger");
    expect(r.flags.stormLevel).toBe(2);
  });

  it("I. fok → 3,9 plafon (a nyugodt 10-es is levágva)", () => {
    const r = computeSupIndex({ ...base, wind_kmh: 5, storm_level: 1 });
    expect(r.index).toBe(3.9);
  });

  it("I. fok nem EMEL: ha az alap már 2, marad 2", () => {
    const r = computeSupIndex({ ...base, wind_kmh: 30, storm_level: 1 });
    expect(r.index).toBe(2);
  });
});

describe("computeSupIndex — büntetések", () => {
  it("lökés-büntetés csak szigorúan >15 delta felett (küszöb: 15 nem büntet)", () => {
    expect(computeSupIndex({ ...base, wind_kmh: 10, gust_kmh: 25 }).index).toBe(10);
    expect(computeSupIndex({ ...base, wind_kmh: 10, gust_kmh: 26 }).index).toBe(8);
  });

  it("hidegvíz-büntetés 14 °C alatt (14 nem büntet, 13,9 igen)", () => {
    expect(computeSupIndex({ ...base, water_temp_c: 14 }).index).toBe(10);
    const cold = computeSupIndex({ ...base, water_temp_c: 13.9 });
    expect(cold.index).toBe(8.5);
    expect(cold.flags.neoprene).toBe(true);
  });

  it("offshore-szorzó ×0,5 + flag (besodró szektor + szél > 15)", () => {
    const r = computeSupIndex({
      ...base,
      wind_kmh: 18,
      wind_dir_deg: 20,
      shore_bearing_deg: 0,
    });
    // 12–20 sáv → 8, offshore ×0,5 → 4
    expect(r.index).toBe(4);
    expect(r.flags.offshoreWind).toBe(true);
  });
});

describe("isOffshoreWind — szektor/szélminimum határai", () => {
  it("pont a szél-minimumon (15) nem offshore; 15,1 igen", () => {
    const cfg = DEFAULT_SUPINDEX_CONFIG.offshore;
    expect(
      isOffshoreWind({ wind_kmh: 15, wind_dir_deg: 0, shore_bearing_deg: 0 }, cfg),
    ).toBe(false);
    expect(
      isOffshoreWind({ wind_kmh: 15.1, wind_dir_deg: 0, shore_bearing_deg: 0 }, cfg),
    ).toBe(true);
  });

  it("szektor-határon (45°) még offshore, 45,1°-nál már nem", () => {
    const cfg = DEFAULT_SUPINDEX_CONFIG.offshore;
    expect(
      isOffshoreWind({ wind_kmh: 20, wind_dir_deg: 45, shore_bearing_deg: 0 }, cfg),
    ).toBe(true);
    expect(
      isOffshoreWind({ wind_kmh: 20, wind_dir_deg: 45.1, shore_bearing_deg: 0 }, cfg),
    ).toBe(false);
  });
});

describe("parseSupIndexConfig — advisor_weights olvasó", () => {
  it("null/üres → default-fallback", () => {
    expect(parseSupIndexConfig(null)).toEqual(DEFAULT_SUPINDEX_CONFIG);
    expect(parseSupIndexConfig([])).toEqual(DEFAULT_SUPINDEX_CONFIG);
  });

  it("felülír egy kulcsot, a többi default marad; ismeretlen/NaN kihagyva", () => {
    const cfg = parseSupIndexConfig([
      { key: "supindex.storm.level1_cap", value: "2.5" },
      { key: "supindex.unknown.key", value: 99 },
      { key: "supindex.gust.penalty", value: "nem-szám" },
    ]);
    expect(cfg.storm.level1Cap).toBe(2.5);
    expect(cfg.gust.penalty).toBe(DEFAULT_SUPINDEX_CONFIG.gust.penalty);
    expect(cfg.wind).toEqual(DEFAULT_SUPINDEX_CONFIG.wind);
  });

  it("a beolvasott konfig valóban hat a számításra (level1_cap=2 → I. fok plafon 2)", () => {
    const cfg = parseSupIndexConfig([
      { key: "supindex.storm.level1_cap", value: 2 },
    ]);
    expect(computeSupIndex({ ...base, storm_level: 1 }, cfg).index).toBe(2);
  });
});
