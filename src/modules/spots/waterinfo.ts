/**
 * „Alapvető információk" — vízenkénti SUP-szabályok, biztonsági tudnivalók és
 * gyakorlati infó (statikus tartalom, séma-módosítás NÉLKÜL — a felszereles-
 * minta, ld. `src/modules/catalog/gear.ts`). Zárt, 4-elemű vízlista.
 *
 * A `t()` nem ad vissza típusbiztosan tömböt (nincs i18next-resource-
 * augmentáció ebben a projektben), ezért a listás tartalmat SZÁMOZOTT
 * kulcsokkal tároljuk (pl. `waters.balaton.rules.0`, `.1`, …) — a route ebből
 * a `WATER_INFO_COUNTS`-ból tudja, hány elemet kell beolvasnia vizenként és
 * kategóriánként.
 */

export const WATER_INFO_SLUGS = ["balaton", "tisza-to", "duna", "tisza"] as const;

export type WaterInfoSlug = (typeof WATER_INFO_SLUGS)[number];

export function isWaterInfoSlug(value: string): value is WaterInfoSlug {
  return (WATER_INFO_SLUGS as readonly string[]).includes(value);
}

interface WaterInfoCounts {
  rules: number;
  safetyNotes: number;
  practical: number;
  /** A Balaton/Tisza-tó közös (megegyező) viharjelző-táblázatot mutatja-e. */
  stormTable: boolean;
  /** A megosztott 3 jogszabály-hivatkozást mutatja-e (a Tisza-nál a szabály csak feltételezett, nincs saját hivatkozás). */
  legalBasis: boolean;
}

export const WATER_INFO_COUNTS: Record<WaterInfoSlug, WaterInfoCounts> = {
  balaton: { rules: 5, safetyNotes: 2, practical: 2, stormTable: true, legalBasis: true },
  "tisza-to": { rules: 6, safetyNotes: 2, practical: 2, stormTable: true, legalBasis: true },
  duna: { rules: 7, safetyNotes: 2, practical: 2, stormTable: false, legalBasis: true },
  tisza: { rules: 2, safetyNotes: 4, practical: 3, stormTable: false, legalBasis: false },
};

/** A megosztott jogszabály-hivatkozás lista hossza (`waterInfo.legalBasis.0` …). */
export const LEGAL_BASIS_COUNT = 3;

/** A megosztott viharjelző-táblázat sorai (`waterInfo.stormTable.<row>.*`). */
export const STORM_TABLE_ROWS = ["none", "level1", "level2"] as const;

interface SpotWaterInfoInput {
  waterType: "to" | "folyo" | "holtag" | "csatorna";
  stormWarningRegion: string | null;
  name: string;
}

/**
 * Egy spot melyik „alapinfo" vízhez tartozik — `null`, ha egyik sem (pl.
 * Velencei-tó, Fertő, vagy egy még nem kategorizált víz). Tavaknál a
 * `storm_warning_region` a megbízható jel; folyóknál ez a mező mindig `null`
 * (ld. `supabase/seed.sql` megjegyzése), ezért ott a spot NEVÉBEN keresünk
 * "Duna"/"Tisza" részletet (pl. „Győr (Mosoni-Duna)", „Szeged (Tisza)").
 */
export function waterInfoSlugForSpot(spot: SpotWaterInfoInput): WaterInfoSlug | null {
  if (spot.stormWarningRegion === "Balaton") return "balaton";
  if (spot.stormWarningRegion === "Tisza-tó") return "tisza-to";
  if (spot.waterType === "folyo") {
    if (/duna/i.test(spot.name)) return "duna";
    if (/tisza/i.test(spot.name)) return "tisza";
  }
  return null;
}
