/**
 * Deszkaválasztó konfiguráció (FEJLESZTESI_DOKUMENTACIO 5.2 + 3.1 advisor_weights).
 *
 * MINDEN súly/szorzó/küszöb az `advisor_weights` tábla `advisor.*` kulcsaiból jön
 * — deploy nélkül hangolható. A kódban HARDCODE-olt súly TILOS; az alábbi
 * `DEFAULT_ADVISOR_CONFIG` KIZÁRÓLAG a táblaolvasó fallback-je, amikor a sor
 * hiányzik vagy a DB nem elérhető. A defaultok szándékosan a `supabase/seed.sql`
 * 310–324. sorával (advisor.* kulcsok) azonosak.
 */

/** Az összes `advisor.*` konfigmező típusosan (5.2). */
export interface AdvisorConfig {
  /** 2. réteg — pontozási súlyok (összeg = 100). */
  weights: {
    stability: number;
    reviews: number;
    value: number;
    purposeFit: number;
    availability: number;
  };
  /** 1. réteg — térfogat-szorzók tapasztalati szintenként. */
  volumeMultiplier: {
    kezdo: number;
    halado: number;
    versenyzo: number;
  };
  /** 1. réteg — utas-többletsúly (effektív súlyhoz). */
  passenger: {
    childKg: number;
    dogKg: number;
  };
  /** 1. réteg — max_load × ez ≥ effektív súly. */
  maxLoadSafetyFactor: number;
  /** 2. réteg — ennyi értékelés alatt a Közös nevező semleges 0,5. */
  reviewsMinCount: number;
}

/**
 * Az `advisor.*` kulcsok → konfigmező leképezése (egy helyen, parse + doksi).
 * A path 1 elemű → top-level skalármező; 2 elemű → beágyazott csoport+mező.
 */
export const ADVISOR_KEYS = {
  "advisor.weight.stability": ["weights", "stability"],
  "advisor.weight.reviews": ["weights", "reviews"],
  "advisor.weight.value": ["weights", "value"],
  "advisor.weight.purpose_fit": ["weights", "purposeFit"],
  "advisor.weight.availability": ["weights", "availability"],
  "advisor.volume_multiplier.kezdo": ["volumeMultiplier", "kezdo"],
  "advisor.volume_multiplier.halado": ["volumeMultiplier", "halado"],
  "advisor.volume_multiplier.versenyzo": ["volumeMultiplier", "versenyzo"],
  "advisor.passenger.child_kg": ["passenger", "childKg"],
  "advisor.passenger.dog_kg": ["passenger", "dogKg"],
  "advisor.max_load.safety_factor": ["maxLoadSafetyFactor"],
  "advisor.reviews.min_count": ["reviewsMinCount"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Fallback-defaultok (== seed advisor.* sorai). Csak akkor élnek, ha a kulcs
 * hiányzik a táblából, vagy a DB nem elérhető. NEM az "igazság forrása".
 */
export const DEFAULT_ADVISOR_CONFIG: AdvisorConfig = {
  weights: {
    stability: 30,
    reviews: 25,
    value: 20,
    purposeFit: 15,
    availability: 10,
  },
  volumeMultiplier: { kezdo: 2.5, halado: 2.2, versenyzo: 2.0 },
  passenger: { childKg: 15, dogKg: 25 },
  maxLoadSafetyFactor: 0.66,
  reviewsMinCount: 5,
};

/** advisor_weights egy sora (key + numeric value). */
export interface AdvisorWeightRow {
  key: string;
  value: number | string;
}

/** A beágyazott (2 elemű path) csoportok neve. */
type NestedGroup = "weights" | "volumeMultiplier" | "passenger";

/**
 * `advisor_weights` sorokból Deszkaválasztó-konfig. Ismeretlen kulcsokat
 * figyelmen kívül hagy; a hiányzó/nem szám kulcsoknál a `DEFAULT_ADVISOR_CONFIG`
 * értéke marad (default-fallback). A struktúrát a defaultból klónozzuk, hogy
 * minden mező típusosan jelen legyen.
 */
export function parseAdvisorConfig(
  rows: readonly AdvisorWeightRow[] | null | undefined,
): AdvisorConfig {
  const config: AdvisorConfig = {
    weights: { ...DEFAULT_ADVISOR_CONFIG.weights },
    volumeMultiplier: { ...DEFAULT_ADVISOR_CONFIG.volumeMultiplier },
    passenger: { ...DEFAULT_ADVISOR_CONFIG.passenger },
    maxLoadSafetyFactor: DEFAULT_ADVISOR_CONFIG.maxLoadSafetyFactor,
    reviewsMinCount: DEFAULT_ADVISOR_CONFIG.reviewsMinCount,
  };

  if (!rows) return config;

  const byKey = new Map<string, number | string>();
  for (const row of rows) byKey.set(row.key, row.value);

  for (const [key, path] of Object.entries(ADVISOR_KEYS)) {
    const raw = byKey.get(key);
    if (raw === undefined) continue;
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num)) continue;

    const group = path[0];
    const field = path[1];
    if (group === undefined) continue;
    if (field === undefined) {
      // Top-level skalármező (maxLoadSafetyFactor / reviewsMinCount).
      (config as unknown as Record<string, number>)[group] = num;
    } else {
      // Beágyazott csoport.mező — a satisfies garantálja a helyes csoportnevet.
      (config[group as NestedGroup] as Record<string, number>)[field] = num;
    }
  }

  return config;
}
