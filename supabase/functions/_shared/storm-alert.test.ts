/**
 * storm-alert orchestráció — körzetenkénti met.hu forrásokkal, injektált I/O-val,
 * hálózat nélkül. Fixture-ök: valódi met.hu main.php letöltések (0-s állapot) +
 * a megfigyelt formátumra hű szintetikus I./II. fokú változatok.
 * A fetched_at MINDIG a scrape-idő (adatkor-szabály).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DEFAULT_SUPINDEX_CONFIG } from "./sup-index.ts";
import {
  buildStormSnapshotRow,
  runStormAlert,
  type RegionSpotState,
  type RegionState,
  type StormAlertDeps,
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

/** Körzet→fixture leképezésből deps.sources + deps.fetchHtml pár. */
function sourcesFromFixtures(
  byRegion: Record<string, string | Error>,
): Pick<StormAlertDeps, "sources" | "fetchHtml"> {
  return {
    sources: Object.keys(byRegion).map((region) => ({
      region,
      url: `https://fixture.test/${region}`,
    })),
    fetchHtml: (url: string) => {
      const region = url.split("/").pop() ?? "";
      const entry = byRegion[region];
      if (entry === undefined) return Promise.reject(new Error("ismeretlen url"));
      return entry instanceof Error
        ? Promise.reject(entry)
        : Promise.resolve(entry);
    },
  };
}

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

describe("runStormAlert — körzetenkénti források", () => {
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

  it("Balaton I. fok + Velence II. fok → 0→1 és 1→2 váltás, 3 spotra bm-okf sor", async () => {
    const inserted: WeatherSnapshotRow[] = [];
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      ...sourcesFromFixtures({
        Balaton: fixture("methu.balaton.level1.html"),
        "Velencei-tó": fixture("methu.velencei-to.level2.html"),
        "Tisza-tó": fixture("methu.tisza-to.html"), // valódi 0-s letöltés
      }),
      getRegionStates: () => Promise.resolve(regionStates()),
      insertSnapshot: (row) => {
        inserted.push(row);
        return Promise.resolve();
      },
    });

    expect(summary.levels).toEqual({ Balaton: 1, "Velencei-tó": 2, "Tisza-tó": 0 });
    expect(summary.changes).toEqual([
      { region: "Balaton", from: 0, to: 1 },
      { region: "Velencei-tó", from: 1, to: 2 },
    ]);
    expect(summary.snapshotsWritten).toBe(3); // 2 balatoni + 1 velencei spot
    expect(summary.errors).toEqual([]);
    expect(inserted.every((r) => r.source === "bm-okf")).toBe(true);
    const vel = inserted.find((r) => r.spot_id === "vel-1");
    expect(vel?.storm_level).toBe(2);
    expect(vel?.sup_index).toBe(0);
    expect(inserted.find((r) => r.spot_id === "bal-1")?.sup_index).toBe(3.9);
  });

  it("valódi 0-s oldalak („alapon van”), minden előző szint 0 → nincs változás", async () => {
    const inserted: WeatherSnapshotRow[] = [];
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      ...sourcesFromFixtures({
        Balaton: fixture("methu.balaton.html"),
        "Velencei-tó": fixture("methu.velencei-to.html"),
        "Tisza-tó": fixture("methu.tisza-to.html"),
      }),
      getRegionStates: () =>
        Promise.resolve(
          regionStates().map((r) => ({ ...r, previousLevel: 0 as const })),
        ),
      insertSnapshot: (row) => {
        inserted.push(row);
        return Promise.resolve();
      },
    });
    expect(summary.levels).toEqual({ Balaton: 0, "Velencei-tó": 0, "Tisza-tó": 0 });
    expect(summary.changes).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("visszaállás (Velence 1→0) a valódi 0-s oldallal, pozitív megerősítéssel", async () => {
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      ...sourcesFromFixtures({
        "Velencei-tó": fixture("methu.velencei-to.html"),
      }),
      getRegionStates: () => Promise.resolve(regionStates()), // Velence previous 1
      insertSnapshot: () => Promise.resolve(),
    });
    expect(summary.changes).toEqual([{ region: "Velencei-tó", from: 1, to: 0 }]);
  });

  it("fetch-hibás körzet unknown marad (nincs leminősítés), a többi feldolgozódik", async () => {
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      ...sourcesFromFixtures({
        Balaton: fixture("methu.balaton.level1.html"),
        "Velencei-tó": new Error("HTTP 503"), // előző szint 1 — NEM eshet 0-ra
      }),
      getRegionStates: () => Promise.resolve(regionStates()),
      insertSnapshot: () => Promise.resolve(),
    });
    expect(summary.levels).toEqual({ Balaton: 1 });
    expect(summary.changes).toEqual([{ region: "Balaton", from: 0, to: 1 }]);
    expect(summary.errors).toEqual([
      { region: "Velencei-tó", message: "HTTP 503" },
    ]);
  });

  it("forrás nélküli körzet (Fertő) kimarad: az utolsó ismert szint él tovább", async () => {
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      ...sourcesFromFixtures({ Balaton: fixture("methu.balaton.html") }),
      getRegionStates: () =>
        Promise.resolve(
          regionStates().map((r) =>
            r.region === "Fertő" ? { ...r, previousLevel: 2 as const } : r,
          ),
        ),
      insertSnapshot: () => Promise.resolve(),
    });
    // Fertő previous 2, nincs forrása → nincs 2→0 hamis leminősítés.
    expect(summary.changes.find((c) => c.region === "Fertő")).toBeUndefined();
  });

  it("egy körzet insert-hibája nem viszi a többit (hibatűrés)", async () => {
    const summary = await runStormAlert({
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      ...sourcesFromFixtures({
        Balaton: fixture("methu.balaton.level1.html"),
        "Velencei-tó": fixture("methu.velencei-to.level2.html"),
      }),
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
