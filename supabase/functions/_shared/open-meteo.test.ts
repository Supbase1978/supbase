/**
 * Open-Meteo adapter (_shared port) — parse fixture-JSON-nal + injektált fetch,
 * hálózat nélkül. A részletes suite a webes modulban (src/modules/weather); itt a
 * port-egyenértékűséget fedjük (az Edge Function ugyanazt a draftot állítja elő).
 */
import { describe, expect, it, vi } from "vitest";

import {
  OPEN_METEO_SOURCE,
  buildForecastUrl,
  fetchOpenMeteoSnapshot,
  parseForecast,
  parseMarine,
  toSnapshotDraft,
} from "./open-meteo.ts";

const forecastJson = {
  current: {
    time: "2026-07-18T12:00",
    temperature_2m: 24.6,
    wind_speed_10m: 18.4,
    wind_gusts_10m: 31.2,
    wind_direction_10m: 205,
  },
};

describe("parseForecast / parseMarine / toSnapshotDraft", () => {
  it("forecast → szél/lökés/irány/léghő + observed_at, water_temp null", () => {
    expect(parseForecast(forecastJson)).toEqual({
      wind_kmh: 18.4,
      gust_kmh: 31.2,
      wind_dir_deg: 205,
      air_temp_c: 24.6,
      water_temp_c: null,
      observed_at: "2026-07-18T12:00",
    });
  });

  it("hiányzó current → csupa null, marine hiánya nem hiba", () => {
    const draft = toSnapshotDraft({});
    expect(draft.wind_kmh).toBeNull();
    expect(draft.water_temp_c).toBeNull();
    expect(draft.source).toBe(OPEN_METEO_SOURCE);
  });

  it("marine current → vízhő beolvasva", () => {
    expect(parseMarine({ current: { sea_surface_temperature: 12.3 } })).toBe(12.3);
    expect(parseMarine({})).toBeNull();
  });

  it("buildForecastUrl km/h egységet kér", () => {
    expect(buildForecastUrl(46.9, 17.9)).toContain("wind_speed_unit=kmh");
  });
});

describe("fetchOpenMeteoSnapshot — injektált fetch", () => {
  it("forecast-only ág (includeMarine=false) draftot ad", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(forecastJson), { status: 200 }),
      ),
    ) as unknown as typeof fetch;
    const draft = await fetchOpenMeteoSnapshot(46.9, 17.9, { fetchImpl });
    expect(draft.wind_kmh).toBe(18.4);
    expect(draft.water_temp_c).toBeNull();
  });

  it("nem-ok forecast → dob (a batch ezt spot-szinten nyeli le)", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response("nope", { status: 503 })),
    ) as unknown as typeof fetch;
    await expect(fetchOpenMeteoSnapshot(46.9, 17.9, { fetchImpl })).rejects.toThrow(
      "Open-Meteo forecast HTTP 503",
    );
  });
});
