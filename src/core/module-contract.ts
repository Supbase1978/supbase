/**
 * Modul-szerződés (FEJLESZTESI_DOKUMENTACIO 1.3) — a bővíthetőség garanciája.
 *
 * 1. Egy modul csak a core-tól és a saját könyvtárától függhet.
 *    Modul→modul import TILOS (ESLint import/no-restricted-paths kényszeríti ki);
 *    közös igény a core-ba kerül.
 * 2. Minden modul exportál egy module.ts manifesztet ebben a formában, és
 *    regisztrálja a src/modules/registry.ts-ben. Új modul = új mappa + regisztráció.
 * 3. Minden modul saját SQL-migrációs fájlokban hozza a tábláit; közös táblákhoz
 *    (users/profiles) csak a core-migrációk nyúlnak.
 */

/** Route-definíció, amit az app/routes.ts vékony rétege komponál RR7 route-tá. */
export interface ModuleRoute {
  /** Locale-független útvonal-minta, pl. "deszkak/:slug". */
  path: string;
  /** A route-modul fájlja az app/routes alatt (RR7 konvenció szerint). */
  file: string;
  /** Igényel-e bejelentkezett sessiont (guard a core/auth-ból). */
  requiresAuth?: boolean;
}

/**
 * Zárt ikon-unió a kezdőlap csempe-navigációjához (`HomeTile`, `app/home-tiles.ts`).
 * A core adja, hogy a modulok csak ebből választhassanak — új ikon = core-módosítás,
 * nem tetszőleges string a modul oldalán.
 */
export type TileIcon = "board" | "gear" | "spot" | "provider" | "info";

export interface ModuleNavEntry {
  /** i18n kulcs a felirathoz (a modul saját namespace-éből). */
  labelKey: string;
  path: string;
  /** Megjelenés a fő navigációban vagy csak a láblécben. */
  placement: "primary" | "footer";
  order: number;
  /**
   * Opcionális: a bejegyzés megjelenik-e a kezdőlap csemperácsában
   * (`app/home-tiles.ts`). Csak `placement: "primary"` bejegyzéshez van
   * értelme. Az advisor (Deszkaválasztó) SZÁNDÉKOSAN nem kap `tile`-t — azt a
   * hero képviseli a kezdőlapon.
   */
  tile?: {
    /** i18n kulcs a csempe leírásához (a modul saját namespace-éből). */
    descriptionKey: string;
    icon: TileIcon;
  };
}

export interface ModuleManifest {
  /** Egyedi modul-azonosító, egyben a mappa neve a src/modules alatt. */
  id: string;
  routes: ModuleRoute[];
  nav: ModuleNavEntry[];
  /** i18next namespace (pl. "advisor" → advisor.json). */
  i18nNamespace: string;
  /** Opcionális admin-panelek (route-ok az /admin alá). */
  adminPanels?: ModuleRoute[];
}
