/**
 * Open-Meteo adapter — parse-logika fixture-JSON-okkal (hálózat nélkül).
 * A fixture-ök a valós API-válasz alakját tükrözik (current blokk).
 */
import { describe, expect, it, vi } from "vitest";

import {
  OPEN_METEO_SOURCE,
  buildForecastUrl,
  buildMarineUrl,
  fetchOpenMeteoSnapshot,
  parseForecast,
  parseMarine,
  toSnapshotDraft,
} from "./adapter";
import forecastBalaton from "./fixtures/forecast.balaton.json";
import marineInland from "./fixtures/marine.inland.json";
import marineSea from "./fixtures/marine.sea.json";

describe("buildForecastUrl / buildMarineUrl", () => {
  it("km/h egységet és a kért current-mezőket kéri", () => {
    const url = buildForecastUrl(46.85, 17.75);
    expect(url).toContain("latitude=46.85");
    expect(url).toContain("longitude=17.75");
    expect(url).toContain("wind_speed_unit=kmh");
    expect(url).toContain("wind_gusts_10m");
  });

  it("marine URL a vízfelszín-hőt kéri", () => {
    expect(buildMarineUrl(45.07, 13.64)).toContain("sea_surface_temperature");
  });
});

describe("parseForecast", () => {
  it("balatoni fixture → szél/lökés/irány/léghő + observed_at", () => {
    expect(parseForecast(forecastBalaton)).toEqual({
      wind_kmh: 18.4,
      gust_kmh: 31.2,
      wind_dir_deg: 205,
      air_temp_c: 24.6,
      water_temp_c: null,
      observed_at: "2026-07-18T12:00",
    });
  });

  it("üres/hibás JSON → minden mező null (nem dob)", () => {
    expect(parseForecast({})).toEqual({
      wind_kmh: null,
      gust_kmh: null,
      wind_dir_deg: null,
      air_temp_c: null,
      water_temp_c: null,
      observed_at: null,
    });
    expect(parseForecast(null).wind_kmh).toBeNull();
    expect(parseForecast({ current: { wind_speed_10m: "18" } }).wind_kmh).toBeNull();
  });
});

describe("parseMarine", () => {
  it("tengeri fixture → vízhő", () => {
    expect(parseMarine(marineSea)).toBe(21.3);
  });

  it("belvízi fixture (nincs adat) → null", () => {
    expect(parseMarine(marineInland)).toBeNull();
  });
});

describe("toSnapshotDraft", () => {
  it("forecast + marine összefésülve, forrás-megjelöléssel", () => {
    const draft = toSnapshotDraft(forecastBalaton, marineSea);
    expect(draft.wind_kmh).toBe(18.4);
    expect(draft.water_temp_c).toBe(21.3);
    expect(draft.source).toBe(OPEN_METEO_SOURCE);
  });

  it("marine nélkül a vízhő null (belvíz — nem hiba)", () => {
    expect(toSnapshotDraft(forecastBalaton).water_temp_c).toBeNull();
  });
});

describe("fetchOpenMeteoSnapshot (injektált fetch, hálózat nélkül)", () => {
  const okResponse = (body: unknown) =>
    ({ ok: true, json: () => Promise.resolve(body) }) as unknown as Response;
  const errorResponse = { ok: false, status: 503 } as unknown as Response;

  it("marine nélkül csak a forecastot hívja", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(forecastBalaton));
    const draft = await fetchOpenMeteoSnapshot(46.85, 17.75, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(draft.wind_kmh).toBe(18.4);
    expect(draft.water_temp_c).toBeNull();
  });

  it("includeMarine: a marine válasz vízhője bekerül", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okResponse(forecastBalaton))
      .mockResolvedValueOnce(okResponse(marineSea));
    const draft = await fetchOpenMeteoSnapshot(45.07, 13.64, {
      fetchImpl,
      includeMarine: true,
    });
    expect(draft.water_temp_c).toBe(21.3);
  });

  it("forecast-hiba → dob; marine-hiba → lenyelt, vízhő null", async () => {
    const failingForecast = vi.fn().mockResolvedValue(errorResponse);
    await expect(
      fetchOpenMeteoSnapshot(46.85, 17.75, { fetchImpl: failingForecast }),
    ).rejects.toThrow("503");

    const failingMarine = vi
      .fn()
      .mockResolvedValueOnce(okResponse(forecastBalaton))
      .mockResolvedValueOnce(errorResponse);
    const draft = await fetchOpenMeteoSnapshot(46.85, 17.75, {
      fetchImpl: failingMarine,
      includeMarine: true,
    });
    expect(draft.water_temp_c).toBeNull();
    expect(draft.wind_kmh).toBe(18.4);
  });
});
