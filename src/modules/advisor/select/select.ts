/**
 * Deszkaválasztó — KÉTRÉTEGŰ ajánló-algoritmus (FEJLESZTESI_DOKUMENTACIO 5.2).
 *
 * Tiszta, mellékhatás-mentes: azonos bemenetre azonos kimenet, nincs I/O, nincs
 * idő-olvasás, nincs AI (a rangsorhoz semmi külső nem nyúl — 5.2 F2 megkötés).
 * Minden súly/szorzó/küszöb a `AdvisorConfig`-ból jön (advisor_weights).
 *
 * 1. réteg — KEMÉNY SZŰRÉS (kizárás): térfogat-ráhagyás, max_load × biztonsági
 *    faktor ≥ effektív súly, elérhetőség, tárolás, ársáv, cél-mapping.
 * 2. réteg — PONTOZÁS (0–100): öt rész-pont [0..1] normálva, súlyozva.
 *
 * Az indoklás SOHA nem kész magyar mondat: {key, params} (advisor namespace).
 */
import type { AdvisorConfig } from "./config";
import { DEFAULT_ADVISOR_CONFIG } from "./config";
import type {
  AdvisorBoardType,
  AdvisorInputs,
  AdvisorReason,
  AdvisorResultItem,
  AdvisorUse,
  BoardForAdvisor,
  Experience,
  WaterChoice,
} from "./types";

/** Indoklás-template kulcsok (az `advisor` namespace-ben feloldva). */
export const REASON_KEYS = {
  volume: "reason.volume",
  stability: "reason.stability",
  maxLoad: "reason.maxLoad",
  reviews: "reason.reviews",
  value: "reason.value",
  purpose: "reason.purpose",
  availability: "reason.availability",
  fresh: "reason.fresh",
} as const;

/** A tapasztalati szint → level.* i18n-kulcs (UI nested-fordítással oldja fel). */
export const LEVEL_KEYS: Record<Experience, string> = {
  kezdo: "level.kezdo",
  halado: "level.halado",
  versenyzo: "level.versenyzo",
};

/** A cél → use.* i18n-kulcs. */
export const USE_KEYS: Record<AdvisorUse, string> = {
  allround: "use.allround",
  tura: "use.tura",
  verseny: "use.verseny",
  joga: "use.joga",
  horgasz: "use.horgasz",
};

/**
 * Cél → preferált board_type-ok (5.2 cél-mapping). Az ELSŐ elem az elsődleges
 * (cél-fit 1,0), a többi másodlagos (0,7). A `kids` egyik célban sem szerepel:
 * gyerekdeszkát felnőtt bemenetre nem ajánlunk (a max_load-szűrő amúgy is
 * kizárja) — józan default. A `river` a `water==="folyo"` ágon jön be (lásd
 * `allowedBoardTypes`).
 */
export const USE_BOARD_TYPES: Record<AdvisorUse, AdvisorBoardType[]> = {
  allround: ["allround", "touring"],
  tura: ["touring", "allround"],
  verseny: ["race"],
  joga: ["yoga", "allround"],
  horgasz: ["fishing", "allround"],
};

/**
 * Domén-referencia a frissesség-pontozáshoz (NEM tunable súly): a legfrissebbnek
 * tekintett modellév. Bővíthető szezononként; a rangsorra csak az
 * elérhetőség/frissesség 10 %-os rész-pontján át hat.
 */
export const CURRENT_MODEL_YEAR = 2024;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Egy tizedesre kerekít. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Effektív súly = testsúly + utas-többlet (gyerek/kutya), konfigból. */
export function effectiveWeight(
  inputs: AdvisorInputs,
  config: AdvisorConfig = DEFAULT_ADVISOR_CONFIG,
): number {
  const add =
    inputs.passenger === "child"
      ? config.passenger.childKg
      : inputs.passenger === "dog"
        ? config.passenger.dogKg
        : 0;
  return inputs.weightKg + add;
}

/**
 * A `use`-hoz (és vízhez) engedélyezett board_type-ok. Folyón a `river` és az
 * `allround` is engedélyezett (a víz a cél-fit pontozásban is számít).
 */
export function allowedBoardTypes(inputs: AdvisorInputs): AdvisorBoardType[] {
  const base = USE_BOARD_TYPES[inputs.use];
  if (inputs.water === "folyo") {
    const extra: AdvisorBoardType[] = ["river", "allround"];
    return Array.from(new Set<AdvisorBoardType>([...base, ...extra]));
  }
  return base;
}

/**
 * 1. réteg — KEMÉNY SZŰRÉS. Igaz → a deszka bekerül a pontozásba.
 * Hiányzó kötelező biztonsági mező (volumeL/maxLoadKg null) → kizárás.
 */
export function passesHardFilter(
  board: BoardForAdvisor,
  inputs: AdvisorInputs,
  config: AdvisorConfig = DEFAULT_ADVISOR_CONFIG,
): boolean {
  // (a) térfogat-ráhagyás: volume ≥ súly × szorzó[szint]
  if (board.volumeL === null) return false;
  if (board.volumeL < inputs.weightKg * config.volumeMultiplier[inputs.experience]) {
    return false;
  }
  // (b) terhelhetőség: max_load × biztonsági faktor ≥ effektív súly
  if (board.maxLoadKg === null) return false;
  if (board.maxLoadKg * config.maxLoadSafetyFactor < effectiveWeight(inputs, config)) {
    return false;
  }
  // (c) itthoni elérhetőség
  if (!board.availabilityHu) return false;
  // (d) tárolás: "csak felfújható" → inflatable
  if (inputs.storage === "inflatable_only" && !board.inflatable) return false;
  // (e) ársáv: csak ha budget ÉS ár is ismert; hiányzó ár NEM zár ki
  if (
    inputs.budgetHuf !== null &&
    board.priceHuf !== null &&
    board.priceHuf > inputs.budgetHuf
  ) {
    return false;
  }
  // (f) cél-mapping (víz-kiterjesztéssel)
  if (!allowedBoardTypes(inputs).includes(board.boardType)) return false;

  return true;
}

/**
 * Normalizált térfogat-ráhagyás [0..1]: (ráhagyás-arány − 1) / 1, vágva.
 * ráhagyás-arány = volume / (súly × szorzó[szint]) — szűrés után ≥ 1.
 * arány 1 → 0 (épp elég), arány ≥ 2 → 1 (bőséges).
 */
function volumeHeadroom(
  board: BoardForAdvisor,
  inputs: AdvisorInputs,
  config: AdvisorConfig,
): number {
  if (board.volumeL === null) return 0;
  const need = inputs.weightKg * config.volumeMultiplier[inputs.experience];
  if (need <= 0) return 1;
  const ratio = board.volumeL / need;
  return clamp(ratio - 1, 0, 1);
}

/** Normalizált szélesség [0..1]: 60 cm → 0, 90 cm → 1; null → 0,5 semleges. */
function widthNorm(board: BoardForAdvisor): number {
  if (board.widthCm === null) return 0.5;
  return clamp((board.widthCm - 60) / 30, 0, 1);
}

/**
 * Stabilitás-illeszkedés [0..1] — a tapasztalati szint függvénye:
 *   kezdő:     több ráhagyás + szélesebb → magasabb  (0,5·headroom + 0,5·width)
 *   versenyző: kevesebb ráhagyás + keskenyebb → magasabb  (0,5·(1−h) + 0,5·(1−w))
 *   haladó:    mérsékelt a jó — a 0,5 körüli értékek jutalmazva
 *              (1 − |h−0,5| − |w−0,5|), vágva [0..1].
 */
export function stabilityScore(
  board: BoardForAdvisor,
  inputs: AdvisorInputs,
  config: AdvisorConfig,
): number {
  const h = volumeHeadroom(board, inputs, config);
  const w = widthNorm(board);
  let raw: number;
  switch (inputs.experience) {
    case "kezdo":
      raw = 0.5 * h + 0.5 * w;
      break;
    case "versenyzo":
      raw = 0.5 * (1 - h) + 0.5 * (1 - w);
      break;
    default:
      raw = 1 - Math.abs(h - 0.5) - Math.abs(w - 0.5);
      break;
  }
  return clamp(raw, 0, 1);
}

/** Közös nevező [0..1]: ≥ min_count értékelésnél avg/5, különben semleges 0,5. */
export function reviewsScore(board: BoardForAdvisor, config: AdvisorConfig): number {
  if (board.reviewCount >= config.reviewsMinCount && board.reviewAvg !== null) {
    return clamp(board.reviewAvg / 5, 0, 1);
  }
  return 0.5;
}

/**
 * Ár-érték [0..1]:
 *   budget ÉS ár ismert → (1 − ár/budget) [0..1] × (ratingValue/5, vagy 0,6)
 *   nincs budget/ár     → ratingValue/5, vagy 0,5
 */
export function valueScore(board: BoardForAdvisor, inputs: AdvisorInputs): number {
  if (inputs.budgetHuf !== null && board.priceHuf !== null && inputs.budgetHuf > 0) {
    const pos = clamp(1 - board.priceHuf / inputs.budgetHuf, 0, 1);
    const rating = board.ratingValueAvg !== null ? clamp(board.ratingValueAvg / 5, 0, 1) : 0.6;
    return clamp(pos * rating, 0, 1);
  }
  return board.ratingValueAvg !== null ? clamp(board.ratingValueAvg / 5, 0, 1) : 0.5;
}

/** Víz-illeszkedés [0..1] a board_type és a tervezett közeg alapján. */
function waterFit(bt: AdvisorBoardType, water: WaterChoice): number {
  if (water === "folyo") {
    return bt === "river" || bt === "allround" ? 1.0 : 0.7;
  }
  if (water === "vedett") {
    return bt === "yoga" || bt === "allround" ? 1.0 : 0.8;
  }
  // nagy tó
  return bt === "touring" || bt === "allround" || bt === "race" ? 1.0 : 0.8;
}

/**
 * Cél-fit [0..1]: board_type egyezés a cél-mappinggel (elsődleges → 1,0,
 * másodlagos → 0,7, csak víz-kiterjesztésből engedett → 0,5) × víz-illeszkedés.
 */
export function purposeFitScore(board: BoardForAdvisor, inputs: AdvisorInputs): number {
  const pref = USE_BOARD_TYPES[inputs.use];
  const idx = pref.indexOf(board.boardType);
  const typeScore = idx === 0 ? 1.0 : idx > 0 ? 0.7 : 0.5;
  return clamp(typeScore * waterFit(board.boardType, inputs.water), 0, 1);
}

/**
 * Elérhetőség/frissesség [0..1]: a szűrés után elérhető (1,0 alap), a modellév
 * frissességével modulálva (2024 → 1,0, évente −0,15, padló 0,5); null → 0,7.
 */
export function availabilityScore(
  board: BoardForAdvisor,
  currentYear: number = CURRENT_MODEL_YEAR,
): number {
  if (board.modelYear === null) return 0.7;
  const age = Math.max(0, currentYear - board.modelYear);
  return clamp(1 - age * 0.15, 0.5, 1);
}

/** Egy rész-pont a súlyozott hozzájárulásával, indoklás-kulccsal. */
interface Part {
  /** stabil rendezési sorrend (tie-break). */
  order: number;
  /** part[0..1] × súly. */
  contribution: number;
  /** null → nincs elég adat az indokláshoz (kihagyjuk a reasons-ból). */
  reason: AdvisorReason | null;
}

/**
 * 2. réteg — PONTOZÁS. Öt rész-pont [0..1] súlyozva, 0–100-ra normálva. A
 * `reasons` a domináns (legnagyobb súlyozott hozzájárulású) 2 tényezőből + egy
 * kötelező max_load biztonsági megjegyzésből áll (2–3 mondat).
 */
export function scoreBoard(
  board: BoardForAdvisor,
  inputs: AdvisorInputs,
  config: AdvisorConfig = DEFAULT_ADVISOR_CONFIG,
): { score: number; reasons: AdvisorReason[] } {
  const w = config.weights;
  const s = {
    stability: stabilityScore(board, inputs, config),
    reviews: reviewsScore(board, config),
    value: valueScore(board, inputs),
    purposeFit: purposeFitScore(board, inputs),
    availability: availabilityScore(board),
  };

  const weighted =
    s.stability * w.stability +
    s.reviews * w.reviews +
    s.value * w.value +
    s.purposeFit * w.purposeFit +
    s.availability * w.availability;
  const totalW = w.stability + w.reviews + w.value + w.purposeFit + w.availability;
  const score = round1(clamp(totalW > 0 ? (weighted / totalW) * 100 : 0, 0, 100));

  const level = LEVEL_KEYS[inputs.experience];

  const parts: Part[] = [
    {
      order: 0,
      contribution: s.stability * w.stability,
      reason:
        board.volumeL !== null
          ? { key: REASON_KEYS.volume, params: { volume: board.volumeL, level } }
          : { key: REASON_KEYS.stability, params: { level } },
    },
    {
      order: 1,
      contribution: s.reviews * w.reviews,
      reason:
        board.reviewCount >= config.reviewsMinCount && board.reviewAvg !== null
          ? {
              key: REASON_KEYS.reviews,
              params: { avg: round1(board.reviewAvg), count: board.reviewCount },
            }
          : null,
    },
    {
      order: 2,
      contribution: s.value * w.value,
      reason:
        board.priceHuf !== null
          ? { key: REASON_KEYS.value, params: { price: board.priceHuf } }
          : null,
    },
    {
      order: 3,
      contribution: s.purposeFit * w.purposeFit,
      reason: { key: REASON_KEYS.purpose, params: { use: USE_KEYS[inputs.use] } },
    },
    {
      order: 4,
      contribution: s.availability * w.availability,
      reason:
        board.modelYear !== null
          ? board.modelYear >= CURRENT_MODEL_YEAR
            ? { key: REASON_KEYS.fresh, params: { year: board.modelYear } }
            : { key: REASON_KEYS.availability, params: { year: board.modelYear } }
          : null,
    },
  ];

  // Domináns tényezők: súlyozott hozzájárulás szerint csökkenő, tie-break order.
  const dominant = parts
    .filter((p): p is Part & { reason: AdvisorReason } => p.reason !== null)
    .sort((a, b) => b.contribution - a.contribution || a.order - b.order)
    .slice(0, 2)
    .map((p) => p.reason);

  const reasons: AdvisorReason[] = [...dominant];

  // Kötelező biztonsági megjegyzés a max_load-ráhagyásról (max_load szűrés után
  // sosem null). Ez teszi átláthatóvá a "miért biztonságos" döntést.
  if (board.maxLoadKg !== null) {
    reasons.push({
      key: REASON_KEYS.maxLoad,
      params: {
        maxLoad: board.maxLoadKg,
        effWeight: round1(effectiveWeight(inputs, config)),
      },
    });
  }

  return { score, reasons };
}

/**
 * Teljes ajánló: 1. réteg szűr → 2. réteg pontoz → csökkenő score, top `limit`.
 * Determinisztikus tie-break: azonos score-nál boardId szerint növekvő.
 */
export function recommendBoards(
  boards: readonly BoardForAdvisor[],
  inputs: AdvisorInputs,
  config: AdvisorConfig = DEFAULT_ADVISOR_CONFIG,
  limit = 5,
): AdvisorResultItem[] {
  const scored: AdvisorResultItem[] = boards
    .filter((b) => passesHardFilter(b, inputs, config))
    .map((b) => {
      const { score, reasons } = scoreBoard(b, inputs, config);
      return { boardId: b.id, score, reasons };
    });

  scored.sort((a, b) => b.score - a.score || a.boardId.localeCompare(b.boardId));
  return scored.slice(0, Math.max(0, limit));
}
