/**
 * weather-sync — Deno Edge Function (vékony héj), óránkénti cron.
 *
 * FELELŐSSÉG: valós I/O bekötése a _shared TISZTA batch-logikájába. Minden
 * érdemi döntés (SUP-index, hibatűrés, sor-építés) a `_shared/weather-sync.ts`-
 * ben él, Vitesttel tesztelve. Ez a fájl NEM tesztelt és NEM typecheckelt a repo
 * `tsc`-jével (Deno-runtime; kizárva a tsconfigból) — Deno deploy fordítja.
 *
 * ENV (Supabase automatikusan injektálja): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * A service_role kulcs megkerüli az RLS-t — a weather_snapshots-ba csak így írható.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  fetchOpenMeteoSnapshot,
  type WeatherSnapshotDraft,
} from "../_shared/open-meteo.ts";
import {
  parseSupIndexConfig,
  type AdvisorWeightRow,
} from "../_shared/sup-index.ts";
import {
  runWeatherSync,
  type SyncSpot,
} from "../_shared/weather-sync.ts";
import type { StormLevel, WaterType, WeatherSnapshotRow } from "../_shared/types.ts";

interface SpotRow {
  id: string;
  water_type: WaterType;
  shore_bearing_deg: number | null;
  geom: { type: string; coordinates: [number, number] } | null;
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

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // 1) SUP-index konfig az advisor_weights supindex.* soraiból (fallback: default).
  const { data: weightRows } = await supabase
    .from("advisor_weights")
    .select("key, value")
    .like("key", "supindex.%");
  const config = parseSupIndexConfig((weightRows ?? []) as AdvisorWeightRow[]);

  // 2) Spotok (PostGIS geom → GeoJSON a PostgREST-től: coordinates [lon, lat]).
  const { data: spotRows, error: spotErr } = await supabase
    .from("spots")
    .select("id, water_type, shore_bearing_deg, geom");
  if (spotErr) {
    return new Response(JSON.stringify({ error: spotErr.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const spots: SyncSpot[] = [];
  for (const raw of (spotRows ?? []) as SpotRow[]) {
    const coords = raw.geom?.coordinates;
    if (!coords) continue;
    const [lon, lat] = coords;

    // A spot legutóbbi ismert viharfoka (utolsó snapshot storm_level-je).
    const { data: last } = await supabase
      .from("weather_snapshots")
      .select("storm_level")
      .eq("spot_id", raw.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    spots.push({
      id: raw.id,
      lat,
      lon,
      shore_bearing_deg: raw.shore_bearing_deg,
      water_type: raw.water_type,
      includeMarine: false, // belvíz: nincs marine vízhő (F1); tenger-spot később.
      lastStormLevel: stormLevelOf(last?.storm_level),
    });
  }

  // 3) Batch a tiszta orchestrátorral (hibatűrő, injektált I/O-val).
  const summary = await runWeatherSync(spots, {
    config,
    fetchSnapshot: (spot: SyncSpot): Promise<WeatherSnapshotDraft> =>
      fetchOpenMeteoSnapshot(spot.lat, spot.lon, {
        includeMarine: spot.includeMarine,
      }),
    insertSnapshot: async (row: WeatherSnapshotRow): Promise<void> => {
      const { error } = await supabase.from("weather_snapshots").insert(row);
      if (error) throw new Error(error.message);
    },
  });

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
