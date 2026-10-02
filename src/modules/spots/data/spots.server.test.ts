import { describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { WeatherSnapshotRow } from "../types";
import { getSpotBySlug, pickLatestPerSpot, requestSpotRefresh } from "./spots.server";

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
    water_level_cm: null,
    water_level_at: null,
    water_trend: null,
    river_alert_level: null,
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

describe("requestSpotRefresh — az RPC-válasz szűkítése, soha nem dob", () => {
  const SPOT_ID = "11111111-1111-1111-1111-111111111111";

  function clientWithRpcResult(data: unknown, error: { message: string } | null = null) {
    return {
      rpc: (name: string, args: Record<string, unknown>) => {
        expect(name).toBe("request_spot_refresh");
        expect(args).toEqual({ p_spot_id: SPOT_ID });
        return Promise.resolve({ data, error });
      },
    } as unknown as SupabaseClient;
  }

  it.each(["queued", "fresh", "throttled", "not_found", "unavailable"] as const)(
    "ismert RPC-válasz (%s) változatlanul átmegy",
    async (result) => {
      const client = clientWithRpcResult(result);
      await expect(requestSpotRefresh(client, SPOT_ID)).resolves.toBe(result);
    },
  );

  it("RPC-hiba esetén unavailable (nem dob)", async () => {
    const client = clientWithRpcResult(null, { message: "connection error" });
    await expect(requestSpotRefresh(client, SPOT_ID)).resolves.toBe("unavailable");
  });

  it("ismeretlen/váratlan válasz-string esetén unavailable", async () => {
    const client = clientWithRpcResult("something-new");
    await expect(requestSpotRefresh(client, SPOT_ID)).resolves.toBe("unavailable");
  });

  it("null adat (hiba nélkül is) esetén unavailable", async () => {
    const client = clientWithRpcResult(null);
    await expect(requestSpotRefresh(client, SPOT_ID)).resolves.toBe("unavailable");
  });
});
