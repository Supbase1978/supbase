/**
 * storm-alert — Deno Edge Function (vékony héj), 5 perces cron a szezonban.
 *
 * FELELŐSSÉG: valós I/O bekötése a _shared TISZTA orchestrációjába
 * (`_shared/storm-alert.ts` + `_shared/storm-scrape.ts`). A parse, a
 * szintváltás-detektálás és a snapshot-építés mind tesztelt tiszta függvény. Ez
 * a fájl NEM tesztelt és NEM typecheckelt a repo `tsc`-jével (Deno-runtime).
 *
 * A push-küldés F1.9 — itt csak a szintváltás naplózása + notifyStormChange TODO.
 * ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORM_SOURCE_URL (a scrape-forrás).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  parseSupIndexConfig,
  type AdvisorWeightRow,
} from "../_shared/sup-index.ts";
import {
  runStormAlert,
  type RegionSpotState,
  type RegionState,
} from "../_shared/storm-alert.ts";
import type { StormLevel, WaterType, WeatherSnapshotRow } from "../_shared/types.ts";

/** A viharjelzés-forrás — env-ből felülírható (default: OMSZ balatoni viharjelzés). */
const DEFAULT_STORM_SOURCE = "https://www.met.hu/idojaras/viharjelzes/balaton/";

interface SpotRow {
  id: string;
  water_type: WaterType;
  shore_bearing_deg: number | null;
  storm_warning_region: string | null;
}

interface SnapshotRow {
  wind_kmh: number | null;
  gust_kmh: number | null;
  wind_dir_deg: number | null;
  water_temp_c: number | null;
  air_temp_c: number | null;
  storm_level: number | null;
}

function stormLevelOf(value: unknown): StormLevel {
  return value === 1 ? 1 : value === 2 ? 2 : 0;
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Hiányzó SUPABASE_URL / SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
  const sourceUrl = Deno.env.get("STORM_SOURCE_URL") ?? DEFAULT_STORM_SOURCE;

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: weightRows } = await supabase
    .from("advisor_weights")
    .select("key, value")
    .like("key", "supindex.%");
  const config = parseSupIndexConfig((weightRows ?? []) as AdvisorWeightRow[]);

  const summary = await runStormAlert({
    config,
    fetchWarningsHtml: async (): Promise<string> => {
      const res = await fetch(sourceUrl, {
        headers: { "user-agent": "sup-platform-storm-alert/1.0" },
      });
      if (!res.ok) throw new Error(`Viharjelzés-forrás HTTP ${res.status}`);
      return await res.text();
    },
    getRegionStates: async (): Promise<RegionState[]> => {
      const { data: spotRows } = await supabase
        .from("spots")
        .select("id, water_type, shore_bearing_deg, storm_warning_region")
        .not("storm_warning_region", "is", null);

      const byRegion = new Map<string, RegionState>();
      for (const raw of (spotRows ?? []) as SpotRow[]) {
        const region = raw.storm_warning_region;
        if (!region) continue;

        const { data: last } = await supabase
          .from("weather_snapshots")
          .select(
            "wind_kmh, gust_kmh, wind_dir_deg, water_temp_c, air_temp_c, storm_level",
          )
          .eq("spot_id", raw.id)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle<SnapshotRow>();

        const lastStormLevel = stormLevelOf(last?.storm_level);
        const spot: RegionSpotState = {
          spotId: raw.id,
          shore_bearing_deg: raw.shore_bearing_deg,
          water_type: raw.water_type,
          wind_kmh: last?.wind_kmh ?? null,
          gust_kmh: last?.gust_kmh ?? null,
          wind_dir_deg: last?.wind_dir_deg ?? null,
          water_temp_c: last?.water_temp_c ?? null,
          air_temp_c: last?.air_temp_c ?? null,
          lastStormLevel,
        };

        const existing = byRegion.get(region);
        if (existing) {
          existing.spots.push(spot);
          // Körzet-szintű előző szint: a legmagasabb ismert (konzervatív).
          if (lastStormLevel > existing.previousLevel) {
            existing.previousLevel = lastStormLevel;
          }
        } else {
          byRegion.set(region, {
            region,
            previousLevel: lastStormLevel,
            spots: [spot],
          });
        }
      }
      return [...byRegion.values()];
    },
    insertSnapshot: async (row: WeatherSnapshotRow): Promise<void> => {
      const { error } = await supabase.from("weather_snapshots").insert(row);
      if (error) throw new Error(error.message);
    },
  });

  return new Response(JSON.stringify({ source: sourceUrl, ...summary }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
