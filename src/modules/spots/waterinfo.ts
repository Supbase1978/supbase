/**
 * „Alapvető információk" — vízenkénti SUP-szabályok, biztonsági tudnivalók és
 * gyakorlati infó (statikus tartalom, séma-módosítás NÉLKÜL — a felszereles-
 * minta, ld. `src/modules/catalog/gear.ts`). Zárt vízlista.
 *
 * A `t()` nem ad vissza típusbiztosan tömböt (nincs i18next-resource-
 * augmentáció ebben a projektben), ezért a listás tartalmat SZÁMOZOTT
 * kulcsokkal tároljuk (pl. `waters.balaton.rules.0`, `.1`, …) — a route ebből
 * a `WATER_INFO_COUNTS`-ból tudja, hány elemet kell beolvasnia vizenként és
 * kategóriánként.
 *
 * A LISTA SORRENDJE a megjelenítés sorrendje: elöl a négy tó, amin viharjelző
 * szolgálat működik, utána a folyók és a folyó jellegű vizek, végül a
 * kisebb, helyi szabályozású vizek. A kutatás és a források:
 * `docs/VIZTESTEK_KUTATAS.md`.
 */

export const WATER_INFO_SLUGS = [
  "balaton",
  "velencei-to",
  "tisza-to",
  "ferto-to",
  "duna",
  "rsd",
  "tisza",
  "harmas-koros",
  "szigetkoz",
  "orfu",
] as const;

export type WaterInfoSlug = (typeof WATER_INFO_SLUGS)[number];

export function isWaterInfoSlug(value: string): value is WaterInfoSlug {
  return (WATER_INFO_SLUGS as readonly string[]).includes(value);
}

interface WaterInfoCounts {
  rules: number;
  safetyNotes: number;
  practical: number;
  /**
   * A megosztott viharjelző-táblázatot mutatja-e. A `46/2001. (XII. 27.) BM
   * rendelet` 4. § (1) szerint a vihar-előrejelző és viharjelző szolgálat
   * NÉGY vízen működik, április 1. és október 31. között: Balaton,
   * Velencei-tó, Tisza-tó, Fertő tó. Máshol nincs fényjelzéses rendszer.
   */
  stormTable: boolean;
  /**
   * A megosztott jogszabály-hivatkozás listát mutatja-e.
   *
   * Ahol `false`, ott a listát félrevezető lenne kitenni: a Tiszán a szabály
   * csak feltételezett (nincs Tisza-specifikus hivatkozásunk), az orfűi
   * tavaknál pedig a Hajózási Szabályzat NEM a kiindulópont — azok nem
   * víziutak, ott a helyi rend dönt.
   */
  legalBasis: boolean;
}

export const WATER_INFO_COUNTS: Record<WaterInfoSlug, WaterInfoCounts> = {
  balaton: { rules: 5, safetyNotes: 2, practical: 2, stormTable: true, legalBasis: true },
  "velencei-to": { rules: 6, safetyNotes: 2, practical: 2, stormTable: true, legalBasis: true },
  "tisza-to": { rules: 6, safetyNotes: 2, practical: 2, stormTable: true, legalBasis: true },
  "ferto-to": { rules: 4, safetyNotes: 3, practical: 3, stormTable: true, legalBasis: true },
  duna: { rules: 7, safetyNotes: 2, practical: 2, stormTable: false, legalBasis: true },
  rsd: { rules: 7, safetyNotes: 3, practical: 3, stormTable: false, legalBasis: true },
  tisza: { rules: 2, safetyNotes: 4, practical: 3, stormTable: false, legalBasis: false },
  "harmas-koros": { rules: 5, safetyNotes: 4, practical: 3, stormTable: false, legalBasis: true },
  szigetkoz: { rules: 5, safetyNotes: 4, practical: 3, stormTable: false, legalBasis: true },
  orfu: { rules: 5, safetyNotes: 3, practical: 3, stormTable: false, legalBasis: false },
};

/**
 * A megosztott jogszabály-hivatkozás lista hossza (`waterInfo.legalBasis.0` …).
 *
 * A negyedik tétel (`17/2002. (III. 7.) KöViM rendelet`) a 2026-08-29-i
 * kutatás eredménye: EZ dönti el, melyik vízen él egyáltalán a Hajózási
 * Szabályzat, tehát minden vízen releváns — azon is, ami nincs rajta a
 * jegyzéken (ld. `docs/VIZTESTEK_KUTATAS.md`).
 */
export const LEGAL_BASIS_COUNT = 4;

/** A megosztott viharjelző-táblázat sorai (`waterInfo.stormTable.<row>.*`). */
export const STORM_TABLE_ROWS = ["none", "level1", "level2"] as const;

interface SpotWaterInfoInput {
  waterType: "to" | "folyo" | "holtag" | "csatorna";
  stormWarningRegion: string | null;
  name: string;
}

/**
 * Egy spot melyik „alapinfo" vízhez tartozik — `null`, ha egyik sem (pl. egy
 * még nem kategorizált víz). Tavaknál a `storm_warning_region` a megbízható
 * jel; folyóknál ez a mező mindig `null` (ld. `supabase/seed.sql`
 * megjegyzése), ezért ott a spot NEVÉBEN keresünk vízrészletet (pl.
 * „Győr (Mosoni-Duna)", „Szeged (Tisza)").
 *
 * A NÉV-ALAPÚ ÁGBAN A SORREND SZÁMÍT: a specifikus vizek MEGELŐZIK az
 * általánosakat, mert a nevük tartalmazza az általános víz nevét is — a
 * „Ráckevei-Duna" a „Duna" mintára is illeszkedne, és akkor a fővárosi Duna
 * szabályait kapná a saját, korlátozásokkal teli Duna-ága helyett.
 */
export function waterInfoSlugForSpot(spot: SpotWaterInfoInput): WaterInfoSlug | null {
  if (spot.stormWarningRegion === "Balaton") return "balaton";
  if (spot.stormWarningRegion === "Tisza-tó") return "tisza-to";
  if (spot.stormWarningRegion === "Velencei-tó") return "velencei-to";
  if (spot.stormWarningRegion === "Fertő") return "ferto-to";
  if (spot.waterType === "folyo" || spot.waterType === "holtag") {
    if (/ráckevei|soroksári|\brsd\b/i.test(spot.name)) return "rsd";
    if (/körös/i.test(spot.name)) return "harmas-koros";
    if (/szigetköz/i.test(spot.name)) return "szigetkoz";
    if (/duna/i.test(spot.name)) return "duna";
    if (/tisza/i.test(spot.name)) return "tisza";
  }
  if (spot.waterType === "to" && /orfű|pécsi-tó/i.test(spot.name)) return "orfu";
  return null;
}
