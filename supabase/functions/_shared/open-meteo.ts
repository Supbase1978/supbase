/**
 * Open-Meteo adapter — Deno-semleges port (5.1 adatforrások).
 *
 * A parse-logika tiszta és fixture-JSON-nal tesztelt; a `fetch` injektálható,
 * hálózati hívás tesztben TILOS. km/h-t kérünk (`wind_speed_unit=kmh`), így
 * nincs egységkonverzió. Belvízre a marine API nincs adat → water_temp_c null.
 */

export interface WeatherSnapshotDraft {
  wind_kmh: number | null;
  gust_kmh: number | null;
  wind_dir_deg: number | null;
  air_temp_c: number | null;
  water_temp_c: number | null;
  /** ISO-időbélyeg az adat forrás-időpontjáról (current.time). */
  observed_at: string | null;
  source: string;
}

export const OPEN_METEO_SOURCE = "open-meteo";
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const MARINE_BASE = "https://marine-api.open-meteo.com/v1/marine";

interface ForecastResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    wind_direction_10m?: number;
  };
}

interface MarineResponse {
  current?: { time?: string; sea_surface_temperature?: number };
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildForecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m",
    wind_speed_unit: "kmh",
    timezone: "UTC",
  });
  return `${FORECAST_BASE}?${params.toString()}`;
}

export function buildMarineUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "sea_surface_temperature",
    timezone: "UTC",
  });
  return `${MARINE_BASE}?${params.toString()}`;
}

export function parseForecast(json: unknown): Omit<WeatherSnapshotDraft, "source"> {
  const current = (json as ForecastResponse | null | undefined)?.current ?? {};
  return {
    wind_kmh: numOrNull(current.wind_speed_10m),
    gust_kmh: numOrNull(current.wind_gusts_10m),
    wind_dir_deg: numOrNull(current.wind_direction_10m),
    air_temp_c: numOrNull(current.temperature_2m),
    water_temp_c: null,
    observed_at: typeof current.time === "string" ? current.time : null,
  };
}

export function parseMarine(json: unknown): number | null {
  const current = (json as MarineResponse | null | undefined)?.current ?? {};
  return numOrNull(current.sea_surface_temperature);
}

export function toSnapshotDraft(
  forecastJson: unknown,
  marineJson?: unknown,
): WeatherSnapshotDraft {
  const base = parseForecast(forecastJson);
  const water_temp_c = marineJson === undefined ? null : parseMarine(marineJson);
  return { ...base, water_temp_c, source: OPEN_METEO_SOURCE };
}

export interface FetchOpenMeteoOptions {
  fetchImpl?: typeof fetch;
  /** Kérjen-e marine vízhőt (tenger-spotokra true). Default: false. */
  includeMarine?: boolean;
}

/**
 * Spot-koordinátára aktuális snapshot lekérése. Hálózati hívás — élesben NEM
 * tesztelendő; a parse-részt fixture-JSON-nal fedjük. A marine ág hibája lenyelt.
 */
export async function fetchOpenMeteoSnapshot(
  lat: number,
  lon: number,
  options: FetchOpenMeteoOptions = {},
): Promise<WeatherSnapshotDraft> {
  const doFetch = options.fetchImpl ?? globalThis.fetch;

  const forecastRes = await doFetch(buildForecastUrl(lat, lon));
  if (!forecastRes.ok) {
    throw new Error(`Open-Meteo forecast HTTP ${forecastRes.status}`);
  }
  const forecastJson: unknown = await forecastRes.json();

  if (!options.includeMarine) {
    return toSnapshotDraft(forecastJson);
  }

  try {
    const marineRes = await doFetch(buildMarineUrl(lat, lon));
    if (!marineRes.ok) return toSnapshotDraft(forecastJson);
    const marineJson: unknown = await marineRes.json();
    return toSnapshotDraft(forecastJson, marineJson);
  } catch {
    return toSnapshotDraft(forecastJson);
  }
}
