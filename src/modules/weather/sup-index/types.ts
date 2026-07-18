/**
 * SUP-index típusok (FEJLESZTESI_DOKUMENTACIO 5.1).
 *
 * A számítás tiszta és mellékhatás-mentes: bemenet = pillanatnyi mérés + spot
 * geometria + konfig; kimenet = index (0–10), állapot-enum és ok-flagek.
 * FONTOS: az algoritmus SOHA nem ad vissza színt — csak `SupIndexStatus`
 * enumot. A szín+ikon+szöveg hármast a UI állítja elő (2. fejezet, biztonsági
 * szemantika). Ugyanígy az indoklás nem kész magyar mondat, hanem i18n-kulcs +
 * paraméterek (`SupIndexReason`), a szöveg a `weather` namespace-ben él.
 */

/** A spots.water_type CHECK-kényszerével egyező vízteszt-típusok (3.1). */
export type WaterType = "to" | "folyo" | "holtag" | "csatorna";

/** BM OKF viharfok (0 = nincs · 1 = I. fok/plafon · 2 = II. fok/tilos). */
export type StormLevel = 0 | 1 | 2;

/**
 * Kimeneti állapot-enum. A magyar feliratok (Kiváló/Óvatosan/Veszélyes) az
 * i18n-ből jönnek — itt csak a szemantikus kulcs.
 *   safe    ≥ excellent (7)      → "Kiváló"
 *   caution ≥ caution (4)        → "Óvatosan"
 *   danger  < caution            → "Veszélyes"
 */
export type SupIndexStatus = "safe" | "caution" | "danger";

/** Az 5.1 algoritmus bemenete (mérés + spot geometria). */
export interface SupIndexInput {
  /** Átlagos szélsebesség km/h. */
  wind_kmh: number;
  /** Széllökés km/h. */
  gust_kmh: number;
  /** Meteorológiai szélirány (ahonnan FÚJ), 0–360°. */
  wind_dir_deg: number;
  /** Vízhőmérséklet °C; null, ha nincs mérés (ilyenkor nincs hidegvíz-büntetés). */
  water_temp_c: number | null;
  /** Viharfok (override-forrás). */
  storm_level: StormLevel;
  /**
   * A part tájolása fokban — az a meteorológiai szélirány, amely tiszta
   * BESODRÓ (offshore) szelet jelent erre a spotra. null → nincs offshore-
   * számítás (lásd sup-index.ts kommentjét az értelmezésről).
   */
  shore_bearing_deg: number | null;
  water_type: WaterType;
}

/** Indoklás-template: i18n-kulcs (weather namespace) + interpolációs paraméterek. */
export interface SupIndexReason {
  /** pl. "reason.offshore" — a `weather` namespace-ben feloldva. */
  key: string;
  params: Record<string, string | number>;
}

/** Ok-flagek — a UI ezekből tesz ki kötelező feliratokat/figyelmeztetéseket. */
export interface SupIndexFlags {
  /** Besodró (offshore) szél: KÖTELEZŐ "Besodró szél" felirat (5.1/4). */
  offshoreWind: boolean;
  /** Hidegvíz: neoprén-figyelmeztetés (5.1/5). */
  neoprene: boolean;
  /** A viharfok, amely az override-ot okozta (0/1/2). */
  stormLevel: StormLevel;
}

/** Az 5.1 algoritmus kimenete. */
export interface SupIndexResult {
  /** 0–10, egy tizedesre kerekítve. */
  index: number;
  status: SupIndexStatus;
  flags: SupIndexFlags;
  /** Elsődleges indoklás-template (determinisztikus kiválasztás). */
  reason: SupIndexReason;
}

/**
 * Stale-burokkal ellátott kimenet: ha a snapshot 30 percnél régebbi, az index
 * NEM mutatható aktuálisként (2. fejezet 5. szabály). A stale-eldöntés a
 * core `isStale`-jével történik — lásd reading.ts.
 */
export interface SupIndexReading {
  result: SupIndexResult;
  /** true → a UI "Elavult adat" state-et mutat, az indexet nem aktuálisként. */
  stale: boolean;
}
