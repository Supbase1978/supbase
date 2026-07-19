/**
 * spots-modul sor-típusok (3.1 séma: `spots` / `spot_reports` /
 * `weather_snapshots`) + a UI-propokhoz szánt strukturális típusok.
 *
 * MODUL-SZERZŐDÉS (module.ts): a spots-modul NEM importál weather-típust.
 * `SpotStatus` és a lenti `StormLevel` SAJÁT, minimális strukturális
 * típusok — nem a `@modules/weather/sup-index/types` importjai, még akkor
 * sem, ha a mezőneveik/értékkészletük egybeesik. A weather-fogyasztás
 * (SUP-index kiértékelés) az app/routes/spotok*.tsx route-rétegben történik,
 * ami a spots-modul e típusaira képezi le a weather-modul kimenetét.
 */

/** A `spots.water_type` CHECK-kényszerével egyező vízteszt-típusok. */
export type WaterType = "to" | "folyo" | "holtag" | "csatorna";

/** A `spots.difficulty` CHECK-kényszerével egyező nehézségi szintek. */
export type Difficulty = "konnyu" | "kozepes" | "halado";

/** A `spot_reports.conditions` CHECK-kényszerével egyező körülmény-enum. */
export type ReportConditions = "nyugodt" | "fodrozodo" | "hullamzo" | "veszelyes";

export const REPORT_CONDITIONS: readonly ReportConditions[] = [
  "nyugodt",
  "fodrozodo",
  "hullamzo",
  "veszelyes",
];

/** Típusőr ismeretlen (pl. formData-ból érkező) stringhez. */
export function isReportConditions(value: string): value is ReportConditions {
  return (REPORT_CONDITIONS as readonly string[]).includes(value);
}

/**
 * BM OKF viharfok — SAJÁT, minimális típus (nem a weather-modul
 * `StormLevel`-je, lásd a fájl fejléc-kommentjét).
 */
export type StormLevel = 0 | 1 | 2;

/**
 * UI-státusz a spot-kártyákhoz/térképjelölőkhöz. A `"forbidden"` a
 * `weather_snapshots.storm_level === 2` esetre képződik le a route-rétegben
 * (a weather-modul `SupIndexStatus`-ának csak safe/caution/danger értéke
 * van) — ez az F1.3-reviewer m5 átadási feltétele: II. fokú viharjelzésnél a
 * spots-UI "forbidden" jelvényt mutat, nem "danger"-t.
 */
export type SpotStatus = "safe" | "caution" | "danger" | "forbidden";

/**
 * `public.spots` sor (3.1). A `geom` PostgREST-reprezentációja setup-függő:
 * a projektünkben GeoJSON-objektum (`{type:"Point",coordinates:[lng,lat]}`),
 * máshol EWKB hex-string lehet — mindkettőt a `data/wkb.ts` `pointFromGeom`-ja
 * bontja `{lng,lat}`-ra (ezért `unknown` itt, a parse a védőhatár).
 */
export interface SpotRow {
  id: string;
  name: string;
  slug: Record<string, string>;
  region: string | null;
  country: string;
  water_type: WaterType;
  difficulty: Difficulty | null;
  geom: unknown;
  shore_bearing_deg: number | null;
  storm_warning_region: string | null;
  protected_area: {
    name?: Record<string, string>;
    rules?: Record<string, string>;
  } | null;
  season_info: Record<string, string> | null;
  access_info: Record<string, string> | null;
  safety_notes: Record<string, string> | null;
  created_at: string;
}

/** `public.spot_reports` sor (3.1) — "most itt voltam" alacsony küszöbű engagement. */
export interface SpotReportRow {
  id: string;
  spot_id: string;
  user_id: string;
  conditions: ReportConditions;
  note: string | null;
  photo_url: string | null;
  created_at: string;
}

/** `public.weather_snapshots` sor (3.1) — az Edge Function tölti, kliens csak olvas. */
export interface WeatherSnapshotRow {
  spot_id: string;
  fetched_at: string;
  wind_kmh: number | null;
  gust_kmh: number | null;
  wind_dir_deg: number | null;
  water_temp_c: number | null;
  air_temp_c: number | null;
  wave_cm: number | null;
  storm_level: StormLevel;
  sup_index: number | null;
  source: string;
}
