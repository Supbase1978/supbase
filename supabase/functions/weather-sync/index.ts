/**
 * weather-sync — Deno Edge Function (vékony héj), 30 percenkénti cron
 * (`0,30 * * * *`) ÉS kézi, egy-spotos hívás (`request_spot_refresh()` RPC,
 * `supabase/migrations/20260717099800_spots_manual_refresh.sql`).
 *
 * FELELŐSSÉG: valós I/O bekötése a _shared TISZTA batch-logikájába. Minden
 * érdemi döntés (SUP-index, hibatűrés, sor-építés, body-validálás) a
 * `_shared/weather-sync.ts`-ben él, Vitesttel tesztelve. Ez a fájl NEM tesztelt
 * és NEM typecheckelt a repo `tsc`-jével (Deno-runtime; kizárva a tsconfigból)
 * — Deno deploy fordítja.
 *
 * KÉRÉS-TÖRZS (opcionális): `{}` vagy üres body → MINDEN spot (cron,
 * változatlan viselkedés); `{ "spot_ids": ["<uuid>", ...] }` → csak azok (a
 * kézi frissítés RPC-je pontosan egy elemű tömböt küld). Érvénytelen alak →
 * 400, a batch el sem indul (`parseSyncRequest`, `_shared/weather-sync.ts`).
 *
 * ENV (Supabase automatikusan injektálja): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * A service_role kulcs megkerüli az RLS-t — a weather_snapshots-ba csak így írható.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

import { isServiceRoleRequest } from "../_shared/auth.ts";
import {
  fetchOpenMeteoSnapshot,
  type WeatherSnapshotDraft,
} from "../_shared/open-meteo.ts";
import {
  parseSupIndexConfig,
  type AdvisorWeightRow,
} from "../_shared/sup-index.ts";
import {
  parseSyncRequest,
  runWeatherSync,
  type RiverGaugeState,
  type SyncSpot,
} from "../_shared/weather-sync.ts";
import {
  createVizugyClient,
  pickRiverAlertLevel,
  toGaugeSample,
} from "../_shared/vizugy.ts";
import type { StormLevel, WaterType, WeatherSnapshotRow } from "../_shared/types.ts";

interface SpotRow {
  id: string;
  water_type: WaterType;
  shore_bearing_deg: number | null;
  geom: { type: string; coordinates: [number, number] } | null;
  vizugy_tsz: number | null;
}

/**
 * Vízmérce-állapotok lekérése EGY körben, a batch előtt.
 *
 * FAIL-SAFE: ha a vizugy szolgáltatás elérhetetlen, ÜRES térképet adunk vissza,
 * és a batch fut tovább — a folyó-spotok ilyenkor a régi (alap-büntetéses)
 * indexet kapják. A vízállás hiánya NEM buktathatja az egész időjárás-
 * szinkront, mert akkor MINDEN spot adat nélkül maradna.
 */
async function loadRiverGauges(
  tszList: readonly number[],
): Promise<Map<number, RiverGaugeState>> {
  const gauges = new Map<number, RiverGaugeState>();
  if (tszList.length === 0) return gauges;

  try {
    const client = createVizugyClient(fetch);
    // A készültségi küszöbök a mérce-törzsadatban élnek, és ott is változhatnak
    // — ezért MINDEN futáskor frissen olvassuk, nem másoljuk az adatbázisunkba.
    const stations = await client.fetchStations();
    const byTsz = new Map(stations.map((station) => [station.tsz, station]));
    const series = await client.fetchLevels(tszList);

    for (const tsz of tszList) {
      const sample = toGaugeSample(tsz, series.get(tsz) ?? []);
      const station = byTsz.get(tsz);
      if (!sample || !station) continue;
      gauges.set(tsz, {
        levelCm: sample.levelCm,
        observedAt: sample.observedAt,
        trend: sample.trend,
        alertLevel: pickRiverAlertLevel(sample.levelCm, station.alertLevels),
      });
    }
  } catch (error) {
    console.error("[weather-sync] vizugy hiba (a batch folytatódik):", error);
  }
  return gauges;
}

function stormLevelOf(value: unknown): StormLevel {
  return value === 1 ? 1 : value === 2 ? 2 : 0;
}

Deno.serve(async (req) => {
  // -1) Szerepkör-ellenőrzés A LEGELSŐ lépés — a gateway `verify_jwt`-je csak
  // az aláírást nézi, bármely bejelentkezett user access tokenje átmenne
  // rajta. Ezt a functiont KIZÁRÓLAG a cron és a `request_spot_refresh()`
  // DB-függvény hívhatja, service_role JWT-vel (lásd `_shared/auth.ts`).
  if (!isServiceRoleRequest(req.headers.get("authorization"))) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  // 0) Kérés-törzs validálása ELSŐKÉNT — érvénytelen alaknál a batch el sem
  // indul (nincs felesleges DB-/Open-Meteo-hívás egy rossz kérésért).
  let rawBody: unknown = null;
  const bodyText = await req.text();
  if (bodyText.length > 0) {
    try {
      rawBody = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Érvénytelen JSON a kérés törzsében." }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
  }
  const parsedRequest = parseSyncRequest(rawBody);
  if ("error" in parsedRequest) {
    return new Response(JSON.stringify({ error: parsedRequest.error }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const { spotIds } = parsedRequest;

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
  // `spotIds === null` → minden spot (cron, változatlan viselkedés); egyébként
  // csak a kért spot(ok) — lásd `parseSyncRequest` (kézi frissítés RPC).
  let spotsQuery = supabase
    .from("spots")
    .select("id, water_type, shore_bearing_deg, geom, vizugy_tsz");
  if (spotIds !== null) {
    spotsQuery = spotsQuery.in("id", spotIds);
  }
  const { data: spotRows, error: spotErr } = await spotsQuery;
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
      vizugyTsz: typeof raw.vizugy_tsz === "number" ? raw.vizugy_tsz : null,
    });
  }

  // 2b) Vízmércék (folyó-spotok) — egyetlen körben, a batch előtt.
  const riverGauges = await loadRiverGauges([
    ...new Set(spots.map((spot) => spot.vizugyTsz).filter((tsz): tsz is number => tsz !== null)),
  ]);

  // 3) Batch a tiszta orchestrátorral (hibatűrő, injektált I/O-val).
  const summary = await runWeatherSync(spots, {
    config,
    riverGauges,
    fetchSnapshot: (spot: SyncSpot): Promise<WeatherSnapshotDraft> =>
      fetchOpenMeteoSnapshot(spot.lat, spot.lon, {
        includeMarine: spot.includeMarine,
      }),
    insertSnapshot: async (row: WeatherSnapshotRow): Promise<void> => {
      const { error } = await supabase.from("weather_snapshots").insert(row);
      if (error) throw new Error(error.message);
    },
  });

  return new Response(JSON.stringify({ ...summary, riverGauges: riverGauges.size }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
