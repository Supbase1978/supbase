/**
 * Runtime-független alaptípusok az Edge Functionökhöz (weather-sync, storm-alert).
 *
 * FONTOS: ez a `_shared` fa Deno- ÉS Node/Vitest-semleges — NINCS Deno API,
 * NINCS `npm:`/`jsr:` import, NINCS I/O. A tiszta logika (parse, SUP-index,
 * batch-orchestráció) ide kerül, hogy Vitesttel tesztelhető legyen Node alól;
 * a Deno-belépőpontok (index.ts) csak vékony héjak, amelyek a valós Supabase-
 * klienst és `fetch`-et injektálják ezekbe a tiszta függvényekbe.
 *
 * A típusok szándékosan tükrözik a `src/modules/weather/`-t (3.1 séma + 5.1
 * algoritmus), de önállóak, mert a Deno-bundle nem éri el a web-`@core`/`@modules`
 * aliasokat.
 */

/** BM OKF viharfok: 0 = nincs · 1 = I. fok (plafon) · 2 = II. fok (tilos). */
export type StormLevel = 0 | 1 | 2;

/** A spots.water_type CHECK-kényszerével egyező vízteszt-típusok (3.1). */
export type WaterType = "to" | "folyo" | "holtag" | "csatorna";

/** Kimeneti állapot-enum (a magyar felirat + szín az UI-ban áll össze). */
export type SupIndexStatus = "safe" | "caution" | "danger";

/** Az 5.1 SUP-index bemenete (mérés + spot-geometria + viharfok). */
export interface SupIndexInput {
  wind_kmh: number;
  gust_kmh: number;
  /** Meteorológiai szélirány (ahonnan FÚJ), 0–360°. */
  wind_dir_deg: number;
  /** Vízhő °C; null → nincs hidegvíz-büntetés. */
  water_temp_c: number | null;
  storm_level: StormLevel;
  /** A part tájolása (offshore-szélhez); null → nincs offshore-számítás. */
  shore_bearing_deg: number | null;
  water_type: WaterType;
}

/** Egy weather_snapshots-sorba írandó rekord (3.1 részhalmaz). */
export interface WeatherSnapshotRow {
  spot_id: string;
  wind_kmh: number | null;
  gust_kmh: number | null;
  wind_dir_deg: number | null;
  water_temp_c: number | null;
  air_temp_c: number | null;
  storm_level: StormLevel;
  /** Számított SUP-index (0–10) vagy null, ha nincs elég adat. */
  sup_index: number | null;
  source: string;
  /** ISO-időbélyeg: a snapshot rögzítési ideje (scrape/fetch pillanata). */
  fetched_at: string;
}
