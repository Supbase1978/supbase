/**
 * SUP-index (0–10) — FEJLESZTESI_DOKUMENTACIO 5.1.
 *
 * Tiszta, mellékhatás-mentes függvény: azonos bemenetre azonos kimenet, nincs
 * I/O, nincs idő-olvasás (a stale-eldöntés külön, reading.ts-ben, a core
 * `isStale`-jével). Minden sáv/küszöb/szorzó a `SupIndexConfig`-ból jön.
 *
 * OFFSHORE (besodró) értelmezés: az 5.1 az `|wind_dir − shore_bearing|` képletet
 * adja. A `shore_bearing_deg` mezőt ezért úgy értelmezzük, mint azt a
 * METEOROLÓGIAI szélirányt (ahonnan fúj), amely tiszta besodró (a parttól a
 * nyílt víz felé sodró) szelet jelent a spotra. Besodró, ha a szélirány e körül
 * a `offshore.sectorDeg` fél-szektoron belül van ÉS a szél > `offshore.windMin`.
 * (A tárolt bearinget a spot-adatrögzítés így választja meg — 3.1 komment:
 * "a part tájolása → offshore-szél számításhoz".)
 */
import {
  DEFAULT_SUPINDEX_CONFIG,
  type SupIndexConfig,
} from "./config";
import type {
  SupIndexFlags,
  SupIndexInput,
  SupIndexReason,
  SupIndexResult,
  SupIndexStatus,
} from "./types";

/** Indoklás-template kulcsok (a `weather` namespace-ben feloldva). */
export const REASON_KEYS = {
  storm2: "reason.storm.level2",
  storm1: "reason.storm.level1",
  offshore: "reason.offshore",
  strongWind: "reason.strongWind",
  cold: "reason.cold",
  moderateWind: "reason.moderateWind",
  good: "reason.good",
} as const;

/** Két irányszög (fok) közti legkisebb szögkülönbség, 0–180°. */
export function angularDelta(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/** Szél-alapsáv pontszáma a felső határok alapján (2. lépés). */
function windBaseScore(wind: number, cfg: SupIndexConfig["wind"]): number {
  if (wind <= cfg.band1Max) return cfg.scoreBand1;
  if (wind <= cfg.band2Max) return cfg.scoreBand2;
  if (wind <= cfg.band3Max) return cfg.scoreBand3;
  if (wind <= cfg.band4Max) return cfg.scoreBand4;
  return cfg.scoreBand5;
}

/** Besodró (offshore) szél-e: szektor + szél-minimum (4. lépés). */
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

/** Egy tizedesre kerekít (0,05 → 0,1 fel). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Determinisztikus indoklás-template kiválasztás (prioritási létra). */
function pickReason(
  index: number,
  status: SupIndexStatus,
  flags: SupIndexFlags,
  input: SupIndexInput,
): SupIndexReason {
  if (flags.stormLevel === 2) return { key: REASON_KEYS.storm2, params: {} };
  if (flags.stormLevel === 1) {
    return { key: REASON_KEYS.storm1, params: { index } };
  }
  if (flags.offshoreWind) {
    return { key: REASON_KEYS.offshore, params: { wind: input.wind_kmh } };
  }
  if (status === "danger") {
    return { key: REASON_KEYS.strongWind, params: { wind: input.wind_kmh } };
  }
  if (flags.neoprene) {
    return { key: REASON_KEYS.cold, params: { temp: input.water_temp_c ?? 0 } };
  }
  if (status === "caution") {
    return { key: REASON_KEYS.moderateWind, params: { wind: input.wind_kmh } };
  }
  return { key: REASON_KEYS.good, params: { wind: input.wind_kmh } };
}

/**
 * SUP-index számítás (5.1). Az `config` alapból a `DEFAULT_SUPINDEX_CONFIG`, de
 * élesben a `advisor_weights` `supindex.*` sorai (parseSupIndexConfig).
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

  // 2) szél-alapsáv
  let score = windBaseScore(input.wind_kmh, config.wind);

  // 3) lökés-büntetés (szigorú >)
  if (input.gust_kmh - input.wind_kmh > config.gust.deltaThreshold) {
    score -= config.gust.penalty;
  }

  // 4) offshore (besodró) szorzó
  if (offshoreWind) {
    score *= config.offshore.multiplier;
  }

  // 5) hidegvíz-büntetés
  if (neoprene) {
    score -= config.coldwater.penalty;
  }

  // 6) folyó-korrekció (F1: egyszerű, konfigból hangolt büntetés)
  if (input.water_type === "folyo") {
    score -= config.river.penalty;
  }

  score = clamp(score, 0, 10);

  // 1) OVERRIDE (a végén alkalmazva, de szemantikailag felülír mindent):
  //    II. fok → fix (0) · I. fok → plafon.
  if (input.storm_level === 2) {
    score = config.storm.level2Cap;
  } else if (input.storm_level === 1) {
    score = Math.min(score, config.storm.level1Cap);
  }

  const index = round1(clamp(score, 0, 10));
  const status = toStatus(index, config.threshold);
  const reason = pickReason(index, status, flags, input);

  return { index, status, flags, reason };
}
