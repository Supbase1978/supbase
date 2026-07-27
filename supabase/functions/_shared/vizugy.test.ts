/**
 * vizugy-adapter — parse + készültségi fok + kliens, VALÓDI (letöltött)
 * fixture-ökön, hálózat nélkül.
 *
 * A fixture-ök a 2026-07-27-i éles válaszból származnak (5 állomás, 3 idősor),
 * mert a szolgáltatás mezőnevei magyar rövidítések (`Tsz`, `MdrNev`, `KF1`) —
 * kézzel gyártott mintán a valós alak eltérése észrevétlen maradna.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  computeTrend,
  createVizugyClient,
  parseStations,
  parseTimeSeries,
  pickRiverAlertLevel,
  toGaugeSample,
  type VizugyStation,
} from "./vizugy.ts";

function fixture(name: string): unknown {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8"));
}

const stationsRaw = fixture("vizugy.stations.json");
const seriesRaw = fixture("vizugy.timeseries.json");

/** A három spot-hoz rendelt mérce (docs: PROGRESS F1.11). */
const SZEGED = 2275;
const BACSA = 18;
const BUDAPEST = 1026;
/** Óbuda: KÖZELEBB van a Római-parthoz, de NINCSENEK készültségi szintjei. */
const OBUDA = 121025;

function station(tsz: number): VizugyStation {
  const found = parseStations(stationsRaw).find((s) => s.tsz === tsz);
  if (!found) throw new Error(`nincs ilyen fixture-állomás: ${tsz}`);
  return found;
}

describe("parseStations", () => {
  it("a valós törzsadat-alakból nevet, folyót és készültségi szinteket olvas", () => {
    expect(station(SZEGED)).toMatchObject({
      tsz: SZEGED,
      name: "Szeged",
      riverName: "Tisza",
      alertLevels: { first: 650, second: 750, third: 850 },
    });
  });

  it("a hiányzó készültségi szint null, nem 0 — a 0 érvényes vízállás lenne", () => {
    expect(station(OBUDA).alertLevels).toEqual({ first: null, second: null, third: null });
  });

  it("nem tömb vagy Tsz nélküli sor esetén nem dob, hanem kihagyja", () => {
    expect(parseStations(null)).toEqual([]);
    expect(parseStations([{ Nev: "névtelen" }, { Tsz: 7, Nev: "jó" }])).toHaveLength(1);
  });
});

describe("parseTimeSeries / computeTrend / toGaugeSample", () => {
  it("állomásonként időrendes méréseket ad", () => {
    const byStation = parseTimeSeries(seriesRaw);
    const szeged = byStation.get(SZEGED) ?? [];
    expect(szeged.length).toBeGreaterThan(1);
    expect(szeged[szeged.length - 1]).toMatchObject({ valueCm: 61 });
  });

  it("a legutolsó mérés adja a mintát, a saját MÉRÉSI időbélyegével", () => {
    const sample = toGaugeSample(BACSA, parseTimeSeries(seriesRaw).get(BACSA) ?? []);
    expect(sample).toMatchObject({ tsz: BACSA, levelCm: 207 });
    expect(sample?.observedAt).toMatch(/^2026-07-27T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("üres sorozatból nincs minta (nem 0 cm!)", () => {
    expect(toGaugeSample(BUDAPEST, [])).toBeNull();
  });

  it("a hiányzó értékű pontokat kihagyja, nem NaN-ként viszi tovább", () => {
    const parsed = parseTimeSeries([
      { ItemId: 1, TsItemList: [{ UTCTime: "2026-07-27T10:00:00Z" }, { Adat: 5 }, { UTCTime: "2026-07-27T11:00:00Z", Adat: 12 }] },
    ]);
    expect(parsed.get(1)).toEqual([{ observedAt: "2026-07-27T11:00:00Z", valueCm: 12 }]);
  });

  it("a tendencia csak az 5 cm-es zajküszöb FÖLÖTT mozdul", () => {
    const at = (valueCm: number, hour: number) => ({ observedAt: `2026-07-27T0${hour}:00:00Z`, valueCm });
    expect(computeTrend([at(100, 1), at(104, 2)])).toBe("stable");
    expect(computeTrend([at(100, 1), at(106, 2)])).toBe("rising");
    expect(computeTrend([at(100, 1), at(94, 2)])).toBe("falling");
    expect(computeTrend([at(100, 1)])).toBe("stable");
  });
});

describe("pickRiverAlertLevel", () => {
  const szeged = station(SZEGED).alertLevels; // 650 / 750 / 850

  it("a küszöb alatt 0 fok — a jelenlegi 61 cm nyugodt nyári vízállás", () => {
    expect(pickRiverAlertLevel(61, szeged)).toBe(0);
    expect(pickRiverAlertLevel(649, szeged)).toBe(0);
  });

  it("PONTOSAN a küszöbön már az adott fok érvényes (fail-safe irány)", () => {
    expect(pickRiverAlertLevel(650, szeged)).toBe(1);
    expect(pickRiverAlertLevel(750, szeged)).toBe(2);
    expect(pickRiverAlertLevel(850, szeged)).toBe(3);
  });

  it("a magasabb fok győz, ha több küszöböt is átlép", () => {
    expect(pickRiverAlertLevel(1200, szeged)).toBe(3);
  });

  it("küszöbök nélküli mércén SOHA nem talál ki fokozatot", () => {
    expect(pickRiverAlertLevel(5000, station(OBUDA).alertLevels)).toBe(0);
  });
});

describe("createVizugyClient", () => {
  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  it("egyszer hitelesít, és a tokent újrahasználja a további hívásokhoz", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("AuthApi")) return jsonResponse({ access_token: "T" });
      if (url.includes("InternetVmo")) return jsonResponse(stationsRaw);
      return jsonResponse(seriesRaw);
    });

    const client = createVizugyClient(fetchImpl as never);
    await client.fetchStations();
    const levels = await client.fetchLevels([SZEGED, BACSA, BUDAPEST]);

    expect(calls.filter((call) => call.url.includes("AuthApi"))).toHaveLength(1);
    expect(levels.get(SZEGED)?.length).toBeGreaterThan(0);

    const seriesCall = calls.find((call) => call.url.includes("TsShortList"));
    const body = JSON.parse(String(seriesCall?.init?.body));
    // 68 = felszíni vízállás; a többi adatfajta (hozam, vízhő) hézagos.
    expect(body).toMatchObject({ adatFajtaKod: 68, torzsszamList: [SZEGED, BACSA, BUDAPEST] });
    expect(body.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("üres állomáslistára NEM hív hálózatot", async () => {
    const fetchImpl = vi.fn();
    const client = createVizugyClient(fetchImpl as never);
    expect((await client.fetchLevels([])).size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("hibás auth-válasz beszédes hibát dob (nem csendes null-t)", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503 }));
    const client = createVizugyClient(fetchImpl as never);
    await expect(client.fetchStations()).rejects.toThrow(/vizugy auth: HTTP 503/);
  });

  it("token nélküli 200-as auth-válasz sem megy tovább", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const client = createVizugyClient(fetchImpl as never);
    await expect(client.fetchStations()).rejects.toThrow(/hiányzó access_token/);
  });
});
