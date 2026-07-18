/**
 * SUP-index (0–10) — FEJLESZTESI_DOKUMENTACIO 5.1, Deno-semleges port.
 *
 * Ez a `src/modules/weather/sup-index/` TISZTA logikájának adaptált másolata a
 * `_shared` fába (a Deno-bundle nem éri el a web-`@modules` aliast). A szemantika
 * BIT-AZONOS a webes `computeSupIndex`-szel: azonos sávok, küszöbök, sorrend és
 * kerekítés. MINDEN súly/sáv/küszöb az `advisor_weights` `supindex.*` soraiból
 * jön (parseSupIndexConfig); a kódban hardcode-olt súly TILOS — a
 * DEFAULT_SUPINDEX_CONFIG kizárólag a táblaolvasó fallback-je (== seed.sql).
 */
import type { SupIndexInput, SupIndexStatus, StormLevel } from "./types.ts";

/** Az összes `supindex.*` konfigmező típusosan. */
export interface SupIndexConfig {
  wind: {
    band1Max: number;
    band2Max: number;
    band3Max: number;
    band4Max: number;
    scoreBand1: number;
    scoreBand2: number;
    scoreBand3: number;
    scoreBand4: number;
    scoreBand5: number;
  };
  gust: { deltaThreshold: number; penalty: number };
  offshore: { multiplier: number; windMin: number; sectorDeg: number };
  coldwater: { tempC: number; penalty: number };
  storm: { level1Cap: number; level2Cap: number };
  threshold: { excellent: number; caution: number };
  river: { penalty: number };
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

/** Fallback-defaultok (== supabase/seed.sql). Csak hiányzó kulcs / nincs DB esetén. */
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
 * `advisor_weights` sorokból SUP-index konfig. Ismeretlen kulcsokat kihagy; a
 * hiányzó/nem szám kulcsoknál a DEFAULT_SUPINDEX_CONFIG marad (default-fallback).
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
    (config[group] as Record<string, number>)[field] = num;
  }

  return config;
}

/** Két irányszög (fok) közti legkisebb szögkülönbség, 0–180°. */
export function angularDelta(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

function windBaseScore(wind: number, cfg: SupIndexConfig["wind"]): number {
  if (wind <= cfg.band1Max) return cfg.scoreBand1;
  if (wind <= cfg.band2Max) return cfg.scoreBand2;
  if (wind <= cfg.band3Max) return cfg.scoreBand3;
  if (wind <= cfg.band4Max) return cfg.scoreBand4;
  return cfg.scoreBand5;
}

/** Besodró (offshore) szél-e: szektor + szél-minimum (5.1/4). */
export function isOffshoreWind(
  input: Pick<SupIndexInput, "wind_kmh" | "wind_dir_deg" | "shore_bearing_deg">,
  cfg: SupIndexConfig["offshore"],
): boolean {
  if (input.shore_bearing_deg === null) return false;
  if (input.wind_kmh <= cfg.windMin) return false;
  return angularDelta(input.wind_dir_deg, input.shore_bearing_deg) <= cfg.sectorDeg;
}

function toStatus(index: number, cfg: SupIndexConfig["threshold"]): SupIndexStatus {
  if (index >= cfg.excellent) return "safe";
  if (index >= cfg.caution) return "caution";
  return "danger";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Ok-flagek (a kötelező feliratokhoz — pl. "Besodró szél"). */
export interface SupIndexFlags {
  offshoreWind: boolean;
  neoprene: boolean;
  stormLevel: StormLevel;
}

export interface SupIndexResult {
  index: number;
  status: SupIndexStatus;
  flags: SupIndexFlags;
}

/**
 * SUP-index számítás (5.1). Ugyanaz a lépéssorrend, mint a webes referenciában:
 * (2) szél-alap → (3) lökés-büntetés → (4) offshore-szorzó → (5) hidegvíz →
 * (6) folyó → clamp → (1) storm-override a végén (II. fok fix 0, I. fok plafon).
 */
export function computeSupIndex(
  input: SupIndexInput,
  config: SupIndexConfig = DEFAULT_SUPINDEX_CONFIG,
): SupIndexResult {
  const offshoreWind = isOffshoreWind(input, config.offshore);
  const neoprene =
    input.water_temp_c !== null && input.water_temp_c < config.coldwater.tempC;

  const flags: SupIndexFlags = {
    offshoreWind,
    neoprene,
    stormLevel: input.storm_level,
  };

  let score = windBaseScore(input.wind_kmh, config.wind);

  if (input.gust_kmh - input.wind_kmh > config.gust.deltaThreshold) {
    score -= config.gust.penalty;
  }
  if (offshoreWind) {
    score *= config.offshore.multiplier;
  }
  if (neoprene) {
    score -= config.coldwater.penalty;
  }
  if (input.water_type === "folyo") {
    score -= config.river.penalty;
  }

  score = clamp(score, 0, 10);

  if (input.storm_level === 2) {
    score = config.storm.level2Cap;
  } else if (input.storm_level === 1) {
    score = Math.min(score, config.storm.level1Cap);
  }

  const index = round1(clamp(score, 0, 10));
  const status = toStatus(index, config.threshold);
  return { index, status, flags };
}
