/**
 * weather-sync batch — hibatűrés + sor-építés, injektált I/O-val (hálózat nélkül).
 * Kulcs-követelmény: egy hibás spot NEM viszi el a batchet.
 */
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SUPINDEX_CONFIG } from "./sup-index.ts";
import type { WeatherSnapshotDraft } from "./open-meteo.ts";
import {
  buildSnapshotRow,
  runWeatherSync,
  type SyncSpot,
} from "./weather-sync.ts";
import type { WeatherSnapshotRow } from "./types.ts";

function spot(id: string, over: Partial<SyncSpot> = {}): SyncSpot {
  return {
    id,
    lat: 46.9,
    lon: 17.9,
    shore_bearing_deg: null,
    water_type: "to",
    includeMarine: false,
    lastStormLevel: 0,
    ...over,
  };
}

function draft(over: Partial<WeatherSnapshotDraft> = {}): WeatherSnapshotDraft {
  return {
    wind_kmh: 10,
    gust_kmh: 12,
    wind_dir_deg: 200,
    air_temp_c: 22,
    water_temp_c: null,
    observed_at: "2026-07-18T12:00",
    source: "open-meteo",
    ...over,
  };
}

const NOW = () => new Date("2026-07-18T12:34:56.000Z");

describe("buildSnapshotRow", () => {
  it("SUP-indexet számol és átviszi a lastStormLevel-t + fetched_at-ot", () => {
    const row = buildSnapshotRow(
      spot("s1", { lastStormLevel: 1 }),
      draft({ wind_kmh: 5 }),
      DEFAULT_SUPINDEX_CONFIG,
      NOW().toISOString(),
    );
    expect(row.storm_level).toBe(1);
    expect(row.sup_index).toBe(3.9); // I. fok plafon
    expect(row.source).toBe("open-meteo");
    expect(row.fetched_at).toBe("2026-07-18T12:34:56.000Z");
  });

  it("szél-adat híján sup_index null, de a sort így is építi", () => {
    const row = buildSnapshotRow(
      spot("s2"),
      draft({ wind_kmh: null, wind_dir_deg: null }),
      DEFAULT_SUPINDEX_CONFIG,
      NOW().toISOString(),
    );
    expect(row.sup_index).toBeNull();
    expect(row.wind_kmh).toBeNull();
  });
});

describe("runWeatherSync — hibatűrés", () => {
  it("minden spot ok → ok=total, nincs hiba, minden sor beírva", async () => {
    const inserted: WeatherSnapshotRow[] = [];
    const summary = await runWeatherSync([spot("a"), spot("b"), spot("c")], {
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      fetchSnapshot: () => Promise.resolve(draft()),
      insertSnapshot: (row) => {
        inserted.push(row);
        return Promise.resolve();
      },
    });
    expect(summary).toEqual({ total: 3, ok: 3, failed: 0, errors: [] });
    expect(inserted.map((r) => r.spot_id)).toEqual(["a", "b", "c"]);
  });

  it("egy hibás FETCH nem viszi a batchet — a többi beíródik", async () => {
    const inserted: WeatherSnapshotRow[] = [];
    const summary = await runWeatherSync([spot("a"), spot("bad"), spot("c")], {
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      fetchSnapshot: (s) =>
        s.id === "bad"
          ? Promise.reject(new Error("Open-Meteo forecast HTTP 503"))
          : Promise.resolve(draft()),
      insertSnapshot: (row) => {
        inserted.push(row);
        return Promise.resolve();
      },
    });
    expect(summary.total).toBe(3);
    expect(summary.ok).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toEqual([
      { spotId: "bad", message: "Open-Meteo forecast HTTP 503" },
    ]);
    expect(inserted.map((r) => r.spot_id)).toEqual(["a", "c"]);
  });

  it("egy hibás INSERT is csak azt az egy spotot bukatja", async () => {
    const insert = vi
      .fn<(row: WeatherSnapshotRow) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("duplicate key"))
      .mockResolvedValueOnce(undefined);
    const summary = await runWeatherSync([spot("a"), spot("b"), spot("c")], {
      config: DEFAULT_SUPINDEX_CONFIG,
      now: NOW,
      fetchSnapshot: () => Promise.resolve(draft()),
      insertSnapshot: insert,
    });
    expect(summary.ok).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.errors[0]?.spotId).toBe("b");
  });
});
