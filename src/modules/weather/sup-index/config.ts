/**
 * SUP-index konfiguráció (FEJLESZTESI_DOKUMENTACIO 5.1 + 3.1 advisor_weights).
 *
 * MINDEN sáv/súly/küszöb az `advisor_weights` tábla `supindex.*` kulcsaiból jön
 * — deploy nélkül hangolható (PecAI-minta). A kódban HARDCODE-olt súly TILOS; az
 * alábbi `DEFAULT_SUPINDEX_CONFIG` KIZÁRÓLAG a táblaolvasó fallback-je, amikor a
 * sor hiányzik vagy a DB nem elérhető. A defaultok szándékosan a
 * `supabase/seed.sql` 310–351. sorával azonosak.
 *
 * KULCS-HIÁNYOK a seedhez képest (a seedet NEM módosítjuk — db-engineer terület):
 *   - `supindex.offshore.sector_deg` : a besodró-szektor fél-szélessége fokban.
 *     Az 5.1 hivatkozik a "besodró szektorra", de a seed csak `multiplier`-t és
 *     `wind_min`-t ad. Default fallback: 45° (±45° a shore_bearing körül).
 *   - `supindex.river.penalty` : folyó-korrekció (5.1/6, "F1-ben egyszerű
 *     sávok"). A seedben nincs kulcs. Default fallback: 1.0.
 */

/** Az összes `supindex.*` konfigmező típusosan. */
export interface SupIndexConfig {
  wind: {
    /** Sáv-felső határok km/h (band1..band4), fölötte band5. */
    band1Max: number;
    band2Max: number;
    band3Max: number;
    band4Max: number;
    /** Sávonkénti alappontszám. */
    scoreBand1: number;
    scoreBand2: number;
    scoreBand3: number;
    scoreBand4: number;
    scoreBand5: number;
  };
  gust: {
    /** (gust − wind) e fölött (szigorúan) büntetés. */
    deltaThreshold: number;
    penalty: number;
  };
  offshore: {
    multiplier: number;
    /** Ennél (szigorúan) nagyobb szélnél él az offshore-szorzó. */
    windMin: number;
    /** Besodró-szektor fél-szélessége fokban (seedben nincs → fallback). */
    sectorDeg: number;
  };
  coldwater: {
    /** Ez alatt (szigorúan) hidegvíz-büntetés + neoprén-flag. */
    tempC: number;
    penalty: number;
  };
  storm: {
    /** I. fok → index-plafon. */
    level1Cap: number;
    /** II. fok → fix index (tilos). */
    level2Cap: number;
  };
  threshold: {
    /** ≥ ez → safe ("Kiváló"). */
    excellent: number;
    /** ≥ ez (és < excellent) → caution; alatta danger. */
    caution: number;
  };
  river: {
    /** Folyó-korrekció büntetés (seedben nincs → fallback). */
    penalty: number;
  };
}

/** A supindex.* kulcsok → konfigmező leképezése (egy helyen, parse + doksi). */
export const SUPINDEX_KEYS = {
  "supindex.wind.band1_max": ["wind", "band1Max"],
  "supindex.wind.band2_max": ["wind", "band2Max"],
  "supindex.wind.band3_max": ["wind", "band3Max"],
  "supindex.wind.band4_max": ["wind", "band4Max"],
  "supindex.wind.score.band1": ["wind", "scoreBand1"],
  "supindex.wind.score.band2": ["wind", "scoreBand2"],
  "supindex.wind.score.band3": ["wind", "scoreBand3"],
  "supindex.wind.score.band4": ["wind", "scoreBand4"],
  "supindex.wind.score.band5": ["wind", "scoreBand5"],
  "supindex.gust.delta_threshold": ["gust", "deltaThreshold"],
  "supindex.gust.penalty": ["gust", "penalty"],
  "supindex.offshore.multiplier": ["offshore", "multiplier"],
  "supindex.offshore.wind_min": ["offshore", "windMin"],
  "supindex.offshore.sector_deg": ["offshore", "sectorDeg"],
  "supindex.coldwater.temp_c": ["coldwater", "tempC"],
  "supindex.coldwater.penalty": ["coldwater", "penalty"],
  "supindex.storm.level1_cap": ["storm", "level1Cap"],
  "supindex.storm.level2_cap": ["storm", "level2Cap"],
  "supindex.threshold.excellent": ["threshold", "excellent"],
  "supindex.threshold.caution": ["threshold", "caution"],
  "supindex.river.penalty": ["river", "penalty"],
} as const satisfies Record<string, readonly [keyof SupIndexConfig, string]>;

/**
 * Fallback-defaultok (== seed). Csak akkor élnek, ha a kulcs hiányzik a
 * táblából, vagy a DB nem elérhető. NEM az "igazság forrása" — a hangolt
 * értékek mindig a `supindex.*` sorokból jönnek.
 */
export const DEFAULT_SUPINDEX_CONFIG: SupIndexConfig = {
  wind: {
    band1Max: 12,
    band2Max: 20,
    band3Max: 28,
    band4Max: 38,
    scoreBand1: 10,
    scoreBand2: 8,
    scoreBand3: 5,
    scoreBand4: 2,
    scoreBand5: 0,
  },
  gust: { deltaThreshold: 15, penalty: 2 },
  offshore: { multiplier: 0.5, windMin: 15, sectorDeg: 45 },
  coldwater: { tempC: 14, penalty: 1.5 },
  storm: { level1Cap: 3.9, level2Cap: 0 },
  threshold: { excellent: 7, caution: 4 },
  river: { penalty: 1 },
};

/** advisor_weights egy sora (key + numeric value). */
export interface AdvisorWeightRow {
  key: string;
  value: number | string;
}

/**
 * `advisor_weights` sorokból SUP-index konfig. Ismeretlen kulcsokat figyelmen
 * kívül hagy; a hiányzó/nem szám kulcsoknál a `DEFAULT_SUPINDEX_CONFIG` értéke
 * marad (default-fallback). A struktúrát a defaultból klónozzuk, hogy minden
 * mező típusosan jelen legyen.
 */
export function parseSupIndexConfig(
  rows: readonly AdvisorWeightRow[] | null | undefined,
): SupIndexConfig {
  const config: SupIndexConfig = {
    wind: { ...DEFAULT_SUPINDEX_CONFIG.wind },
    gust: { ...DEFAULT_SUPINDEX_CONFIG.gust },
    offshore: { ...DEFAULT_SUPINDEX_CONFIG.offshore },
    coldwater: { ...DEFAULT_SUPINDEX_CONFIG.coldwater },
    storm: { ...DEFAULT_SUPINDEX_CONFIG.storm },
    threshold: { ...DEFAULT_SUPINDEX_CONFIG.threshold },
    river: { ...DEFAULT_SUPINDEX_CONFIG.river },
  };

  if (!rows) return config;

  const byKey = new Map<string, number | string>();
  for (const row of rows) byKey.set(row.key, row.value);

  for (const [key, path] of Object.entries(SUPINDEX_KEYS)) {
    const raw = byKey.get(key);
    if (raw === undefined) continue;
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num)) continue;
    const [group, field] = path;
    // A leképezés satisfies-szal garantált, ezért a hozzárendelés biztonságos.
    (config[group] as Record<string, number>)[field] = num;
  }

  return config;
}
