import { describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { WeatherSnapshotRow } from "../types";
import { getSpotBySlug, pickLatestPerSpot } from "./spots.server";

function snapshot(overrides: Partial<WeatherSnapshotRow>): WeatherSnapshotRow {
  return {
    spot_id: "spot-1",
    fetched_at: "2026-07-19T10:00:00.000Z",
    wind_kmh: 12,
    gust_kmh: 18,
    wind_dir_deg: 90,
    water_temp_c: 22,
    air_temp_c: 24,
    wave_cm: 5,
    storm_level: 0,
    sup_index: 8,
    source: "open-meteo",
    ...overrides,
  };
}

describe("pickLatestPerSpot", () => {
  it("üres tömbre üres Map-et ad", () => {
    expect(pickLatestPerSpot([])).toEqual(new Map());
  });

  it("egy sor esetén az adott sort adja vissza a spot_id kulcs alatt", () => {
    const row = snapshot({});
    const map = pickLatestPerSpot([row]);
    expect(map.size).toBe(1);
    expect(map.get("spot-1")).toEqual(row);
  });

  it("csökkenő fetched_at rendezés mellett az ELSŐ (legfrissebb) sort tartja meg spotonként", () => {
    const newest = snapshot({ spot_id: "spot-1", fetched_at: "2026-07-19T12:00:00.000Z", sup_index: 9 });
    const older = snapshot({ spot_id: "spot-1", fetched_at: "2026-07-19T09:00:00.000Z", sup_index: 3 });

    // A lekérdezés `fetched_at desc`-cel rendezett — a bemenet ezt a sorrendet tükrözi.
    const map = pickLatestPerSpot([newest, older]);

    expect(map.size).toBe(1);
    expect(map.get("spot-1")).toEqual(newest);
  });

  it("több spot snapshotjait egymástól függetlenül, spotonként legfeljebb egy sorral tartja meg", () => {
    const spot1Newest = snapshot({ spot_id: "spot-1", fetched_at: "2026-07-19T12:00:00.000Z" });
    const spot1Older = snapshot({ spot_id: "spot-1", fetched_at: "2026-07-19T09:00:00.000Z" });
    const spot2Newest = snapshot({ spot_id: "spot-2", fetched_at: "2026-07-19T11:00:00.000Z" });

    const map = pickLatestPerSpot([spot1Newest, spot2Newest, spot1Older]);

    expect(map.size).toBe(2);
    expect(map.get("spot-1")).toEqual(spot1Newest);
    expect(map.get("spot-2")).toEqual(spot2Newest);
  });
});

describe("getSpotBySlug — slug-alak guard", () => {
  // Érvénytelen alakú slugnál a kliens-hívás ELŐTT tér vissza null-lal — a
  // dummy kliens dobna, ha mégis elérné a .from()-ot.
  const throwingClient = new Proxy(
    {},
    {
      get() {
        throw new Error("a supabase-kliens nem hívható érvénytelen slugnál");
      },
    },
  ) as SupabaseClient;

  it.each([
    "x,id.eq.00000000-0000-0000-0000-000000000000", // PostgREST .or() szűrő-injektálás
    "a)b(c",
    "Balatonföldvár", // nagybetű/ékezet — nem slug-alak
    "",
  ])("érvénytelen slugra (%j) null, kliens-hívás nélkül", async (slug) => {
    await expect(getSpotBySlug(throwingClient, slug)).resolves.toBeNull();
  });
});
