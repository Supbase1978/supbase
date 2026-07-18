/**
 * storm-alert orchestráció — szintváltás → bm-okf snapshot (override-os SUP-index),
 * injektált I/O-val, hálózat nélkül. A fetched_at MINDIG a scrape-idő (adatkor).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DEFAULT_SUPINDEX_CONFIG } from "./sup-index.ts";
import {
  buildStormSnapshotRow,
  runStormAlert,
  type RegionSpotState,
  type RegionState,
} from "./storm-alert.ts";
import type { WeatherSnapshotRow } from "./types.ts";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function spotState(over: Partial<RegionSpotState> = {}): RegionSpotState {
  return {
    spotId: "spot",
    shore_bearing_deg: null,
    water_type: "to",
    wind_kmh: 10,
    gust_kmh: 12,
    wind_dir_deg: 200,
    water_temp_c: 20,
    air_temp_c: 22,
    lastStormLevel: 0,
    ...over,
  };
}

const NOW = () => new Date("2026-07-18T13:00:00.000Z");

describe("buildStormSnapshotRow", () => {
  it("az ÚJ viharfokkal újraszámol: II. fok → sup_index 0, source bm-okf", () => {
    const row = buildStormSnapshotRow(
      spotState({ wind_kmh: 5 }),
      2,
      DEFAULT_SUPINDEX_CONFIG,
      NOW().toISOString(),
    );
    expect(row.storm_level).toBe(2);
    expect(row.sup_index).toBe(0);
    expect(row.source).toBe("bm-okf");
    expect(row.fetched_at).toBe("2026-07-18T13:00:00.000Z");
  });

  it("visszaállásnál (→0) a mért szél alapján áll vissza az index", () => {
    const row = buildStormSnapshotRow(
      spotState({ wind_kmh: 5 }),
      0,
      DEFAULT_SUPINDEX_CONFIG,
      NOW().toISOString(),
    );
    expect(row.sup_index).toBe(10);
  });
});

describe("runStormAlert", () => {
  const regionStates = (): RegionState[] => [
    {
      region: "Balaton",
      previousLevel: 0,
      spots: [spotState({ spotId: "bal-1" }), spotState({ spotId: "bal-2" })],
    },
    {
      region: "Velencei-tó",
      previousLevel: 1,
      spots: [spotState({ spotId: "vel-1" })],
    },
    { region: "Tisza-tó", previousLevel: 0, spots: [spotState({ spotId: "tis-1" })] },
    { region: "Fertő", previousLevel: 0, spots: [spotState({ spotId: "fer-1" })] },
  ];

  it("level2-velence fixture: Balaton 0→1 és Velence 1→2 → 3 spotra ír bm-okf sort", async () => {
    const inserted: WeatherSnapshotRow[] = [];
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      fetchWarningsHtml: () =>
        Promise.resolve(fixture("storm.level2-velence.html")),
      getRegionStates: () => Promise.resolve(regionStates()),
      insertSnapshot: (row) => {
        inserted.push(row);
        return Promise.resolve();
      },
    });

    expect(summary.changes).toEqual([
      { region: "Balaton", from: 0, to: 1 },
      { region: "Velencei-tó", from: 1, to: 2 },
    ]);
    expect(summary.snapshotsWritten).toBe(3); // 2 balatoni + 1 velencei spot
    expect(summary.errors).toEqual([]);
    expect(inserted.every((r) => r.source === "bm-okf")).toBe(true);
    // Velencei spot II. fok → index 0; balatoni spotok I. fok plafon 3,9.
    const vel = inserted.find((r) => r.spot_id === "vel-1");
    expect(vel?.storm_level).toBe(2);
    expect(vel?.sup_index).toBe(0);
    expect(inserted.find((r) => r.spot_id === "bal-1")?.sup_index).toBe(3.9);
  });

  it("nincs jelzés fixture, minden előző szint 0 → nincs változás, nincs írás", async () => {
    const inserted: WeatherSnapshotRow[] = [];
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      fetchWarningsHtml: () => Promise.resolve(fixture("storm.none.html")),
      getRegionStates: () => Promise.resolve(regionStates().map((r) => ({ ...r, previousLevel: 0 as const }))),
      insertSnapshot: (row) => {
        inserted.push(row);
        return Promise.resolve();
      },
    });
    expect(summary.changes).toEqual([]);
    expect(summary.snapshotsWritten).toBe(0);
    expect(inserted).toEqual([]);
  });

  it("visszaállás (Velence 1→0) a none-fixture-rel detektálva", async () => {
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      fetchWarningsHtml: () => Promise.resolve(fixture("storm.none.html")),
      getRegionStates: () => Promise.resolve(regionStates()), // Velence previousLevel 1
      insertSnapshot: () => Promise.resolve(),
    });
    expect(summary.changes).toEqual([{ region: "Velencei-tó", from: 1, to: 0 }]);
  });

  it("egy körzet insert-hibája nem viszi a többit (hibatűrés)", async () => {
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      fetchWarningsHtml: () =>
        Promise.resolve(fixture("storm.level2-velence.html")),
      getRegionStates: () => Promise.resolve(regionStates()),
      insertSnapshot: (row) =>
        row.spot_id === "vel-1"
          ? Promise.reject(new Error("insert failed"))
          : Promise.resolve(),
    });
    // Balaton (0→1) sikeres 2 írás; Velence (1→2) hibázik.
    expect(summary.snapshotsWritten).toBe(2);
    expect(summary.errors).toEqual([
      { region: "Velencei-tó", message: "insert failed" },
    ]);
  });
});
