/**
 * AQUA MARINA HUNGARY (aquamarinahungary.com) — magyar BOLT
 *
 * Nem márka-forrás: a haszna a MAGYAR ÁR és elérhetőség a már ismert
 * deszkákra. A jelöltjei a gyártói sorokra illeszkednek, nem új típusok.
 *
 *  * A méret-sort elgépelt mértékegységgel is írja („Mérete (366m x 84x 15m)"),
 *    miközben a leírásban helyesen szerepel — ezért van címke NÉLKÜLI
 *    hármas-keresés is.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Aqua Marina Hungary",
  baseUrl: "https://aquamarinahungary.com",
  kind: "shop",
  country: "HU",
  crawlConfig: {
      // GALÉRIA (F2.1-utó-56): A bolt `_altpic_1..4` képei a termék SAJÁT cikkszám-mappájában — 5 kép. Ez pótolja a gyártói oldalt, ami modellenként csak 1-2 fotót közöl.
      galleryClass: "page_artdet_altpic",
      "notes": "Hivatalos HU Aqua Marina-forgalmazo (Sportstore.hu Kft), JSON-LD 9/10 mintan validalva 2026-07-31",
      "defaultBrandName": "Aqua Marina",
      "excludeUrlPatterns": [
          "/spl/",
          "shop_",
          "/sct/",
          "kajak"
      ]
  },
};
