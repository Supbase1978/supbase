/**
 * vizugy.hu (VMSzolgáltatás) adapter — folyó-spotok vízállása, 5.1/6.
 *
 * MIÉRT EZ A FORRÁS: a spec „HydroInfo vízállás"-t ír, de a hydroinfo.hu csak
 * HTML-t ad (scrape). A `data.vizugy.hu` mögötti REST API UGYANAZT az OVF-adatot
 * szolgálja ki JSON-ban, ÉS állomásonként megadja a HIVATALOS árvízvédelmi
 * készültségi szinteket (KF1/KF2/KF3 = I./II./III. fok). Ez azért döntő, mert
 * így NEM kell kitalált cm-sávokat gyártanunk: a küszöb hatósági érték, amit az
 * OVF állapít meg mércénként. (A forrás a felhasználó DunApp-projektjében évek
 * óta üzemel — a kliens-logika onnan származik.)
 *
 * FONTOS: ez a fájl a `_shared` szabályai szerint Deno- ÉS Node-semleges —
 * nincs Deno API, nincs `npm:`/`jsr:` import. A hálózat INJEKTÁLT `fetch`-en
 * jön, így Vitesttel, hálózat nélkül tesztelhető.
 */

/** Adatfajta-kódok (adatFajtaKod) — a szolgáltatás saját kódszótárából. */
export const VIZUGY_DATA_TYPE = {
  /** Felszíni vízállás (cm). */
  WATER_LEVEL: 68,
  /** Felszíni vízhozam (m³/s). */
  FLOW_RATE: 87,
  /** Vízhő a vízfelszín közelében (°C). */
  WATER_TEMP: 85,
} as const;

const AUTH_URL = "https://data.vizugy.hu/AuthApi/auth/token";
const API_BASE = "https://vmservice.vizugy.hu/vraquery";
/**
 * A szolgáltatás CSAK erről az originről ad tokent — ez nem trükk, hanem a
 * publikus webes kliens azonosítója. A User-Agentben megnevezzük magunkat.
 */
const ORIGIN = "https://data.vizugy.hu";
const USER_AGENT = "Mozilla/5.0 (compatible; SuptimeBot/1.0; +https://suptime.hu)";

export const VIZUGY_SOURCE = "vizugy";

/** Árvízvédelmi készültségi fok: 0 = nincs · 1/2/3 = I./II./III. fok. */
export type RiverAlertLevel = 0 | 1 | 2 | 3;

/** Vízállás-tendencia (a mérés-sorozat elejéhez képest). */
export type WaterTrend = "rising" | "falling" | "stable";

/** Egy vízmérce-állomás a törzsadat-listából. */
export interface VizugyStation {
  tsz: number;
  name: string;
  /** A vízfolyás neve (`MdrNev`) — a spot–állomás párosítás ELLENŐRZÉSÉHEZ. */
  riverName: string;
  lat: number | null;
  lon: number | null;
  riverKm: number | null;
  /** I./II./III. fokú készültségi vízállás (cm). Csak ~150 mércén van. */
  alertLevels: { first: number | null; second: number | null; third: number | null };
}

export interface WaterReading {
  /** A MÉRÉS ideje (a forrásé), nem a lekérésé. */
  observedAt: string;
  valueCm: number;
}

export interface RiverGaugeSample {
  tsz: number;
  levelCm: number;
  observedAt: string;
  trend: WaterTrend;
}

interface RawStation {
  Tsz?: number;
  Nev?: string;
  MdrNev?: string;
  Lat?: number;
  Lon?: number;
  Fkm?: number;
  KF1?: number;
  KF2?: number;
  KF3?: number;
}

interface RawSeriesItem {
  ItemId?: number;
  TsItemList?: Array<{ UTCTime?: string; Adat?: number }>;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Törzsadat-lista parse — hibás/hiányos sorok kimaradnak, nem dobnak. */
export function parseStations(raw: unknown): VizugyStation[] {
  if (!Array.isArray(raw)) return [];
  const stations: VizugyStation[] = [];
  for (const entry of raw as RawStation[]) {
    const tsz = numberOrNull(entry?.Tsz);
    if (tsz === null) continue;
    stations.push({
      tsz,
      name: typeof entry.Nev === "string" ? entry.Nev : "",
      riverName: typeof entry.MdrNev === "string" ? entry.MdrNev : "",
      lat: numberOrNull(entry.Lat),
      lon: numberOrNull(entry.Lon),
      riverKm: numberOrNull(entry.Fkm),
      alertLevels: {
        first: numberOrNull(entry.KF1),
        second: numberOrNull(entry.KF2),
        third: numberOrNull(entry.KF3),
      },
    });
  }
  return stations;
}

/**
 * Idősor-parse. A mérések időrendben jönnek; a `null`/hiányos értékek
 * kimaradnak, mert egy kimaradt óra nem hiba (a mércék karbantartás alatt
 * állhatnak), viszont NaN-t sosem engedünk a pontozásba.
 */
export function parseTimeSeries(raw: unknown): Map<number, WaterReading[]> {
  const byStation = new Map<number, WaterReading[]>();
  if (!Array.isArray(raw)) return byStation;

  for (const item of raw as RawSeriesItem[]) {
    const tsz = numberOrNull(item?.ItemId);
    if (tsz === null) continue;
    const readings: WaterReading[] = [];
    for (const point of item.TsItemList ?? []) {
      const value = numberOrNull(point?.Adat);
      const time = typeof point?.UTCTime === "string" ? point.UTCTime : null;
      if (value === null || time === null) continue;
      readings.push({ observedAt: time, valueCm: value });
    }
    byStation.set(tsz, readings);
  }
  return byStation;
}

/**
 * Tendencia a sorozat első és utolsó mérése között.
 *
 * A küszöb (5 cm) SZÁNDÉKOSAN nem 0: a mércék centiméterre kerekítenek, és egy
 * 1–2 cm-es ingadozás nem tendencia, hanem zaj — a felhasználónak „emelkedik"
 * feliratot mutatni rá félrevezető lenne.
 */
export function computeTrend(readings: readonly WaterReading[], thresholdCm = 5): WaterTrend {
  if (readings.length < 2) return "stable";
  const first = readings[0];
  const last = readings[readings.length - 1];
  if (!first || !last) return "stable";
  const delta = last.valueCm - first.valueCm;
  if (delta > thresholdCm) return "rising";
  if (delta < -thresholdCm) return "falling";
  return "stable";
}

/** A legutolsó mérés + tendencia egy állomás sorozatából. */
export function toGaugeSample(tsz: number, readings: readonly WaterReading[]): RiverGaugeSample | null {
  const last = readings[readings.length - 1];
  if (!last) return null;
  return { tsz, levelCm: last.valueCm, observedAt: last.observedAt, trend: computeTrend(readings) };
}

/**
 * Készültségi fok a HIVATALOS küszöbökből.
 *
 * FAIL-SAFE, két irányban:
 * - hiányzó küszöb → 0 (nem találunk ki értéket); a hívó ilyenkor a
 *   konfigurált alap-folyóbüntetést használja, tehát a viselkedés NEM romlik;
 * - a magasabb fok győz (`>=`): pontosan a küszöbön állva már az adott fok
 *   érvényes — az OVF is így hirdeti ki, és a fail-safe irány is ez.
 */
export function pickRiverAlertLevel(
  levelCm: number,
  levels: VizugyStation["alertLevels"],
): RiverAlertLevel {
  if (levels.third !== null && levelCm >= levels.third) return 3;
  if (levels.second !== null && levelCm >= levels.second) return 2;
  if (levels.first !== null && levelCm >= levels.first) return 1;
  return 0;
}

// ─── I/O (injektált fetch) ──────────────────────────────────────────────────

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface VizugyClient {
  fetchStations: () => Promise<VizugyStation[]>;
  fetchLevels: (tszList: readonly number[], lookbackHours?: number) => Promise<Map<number, WaterReading[]>>;
}

/** ISO-időbélyeg ezredmásodperc nélkül — a szolgáltatás így várja. */
function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Kliens a szolgáltatáshoz. A token ~15 percig él, ezért a példány CACHE-eli —
 * egy cron-futásban így egyetlen auth-hívás van, akárhány lekérdezéshez.
 */
export function createVizugyClient(fetchImpl: FetchLike, now: () => Date = () => new Date()): VizugyClient {
  let token: string | null = null;
  let tokenExpiresAt = 0;

  async function getToken(): Promise<string> {
    if (token !== null && now().getTime() < tokenExpiresAt) return token;

    const response = await fetchImpl(AUTH_URL, {
      headers: { Origin: ORIGIN, Referer: `${ORIGIN}/`, "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`vizugy auth: HTTP ${response.status}`);
    }
    const json = (await response.json()) as { access_token?: unknown };
    if (typeof json.access_token !== "string" || json.access_token.length === 0) {
      throw new Error("vizugy auth: hiányzó access_token");
    }
    token = json.access_token;
    // A JWT lejáratát NEM fejtjük vissza: egy fix, rövid élettartam
    // (10 perc) egyszerűbb és biztonságos — rosszabb esetben egy fölösleges
    // auth-hívás az ára, nem lejárt tokenre futó 401.
    tokenExpiresAt = now().getTime() + 10 * 60 * 1000;
    return token;
  }

  async function authorized(path: string, init?: RequestInit): Promise<unknown> {
    const bearer = await getToken();
    const response = await fetchImpl(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${bearer}`,
        Origin: ORIGIN,
        "User-Agent": USER_AGENT,
      },
    });
    if (!response.ok) {
      throw new Error(`vizugy ${path}: HTTP ${response.status}`);
    }
    return response.json();
  }

  return {
    async fetchStations() {
      // A `11` a felszíni vízmércék listája (a `12` a talajvízkutaké).
      return parseStations(await authorized("/Vra/InternetVmo/11/false"));
    },

    async fetchLevels(tszList, lookbackHours = 6) {
      if (tszList.length === 0) return new Map();
      const end = now();
      const start = new Date(end.getTime() - lookbackHours * 3_600_000);
      const raw = await authorized("/TS/TsShortList", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          torzsszamList: [...tszList],
          adatFajtaKod: VIZUGY_DATA_TYPE.WATER_LEVEL,
          adatTipusKod: 100,
          startTime: isoSeconds(start),
          endTime: isoSeconds(end),
          dataExtFilter: null,
          valueFilter: "Relativ",
        }),
      });
      return parseTimeSeries(raw);
    },
  };
}
