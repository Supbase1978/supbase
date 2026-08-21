/**
 * BLUEFIN (bluefinsupboards.eu)
 *
 *  * A méret néhány termékvonalon CSAK a böngészőben kerül a látható
 *    szövegbe — ez a forrás hívta életre a `render.ts` fallbacket.
 *  * A JSON-LD márkaneve a termékek nagy részén „Bluefin-testing" (a bolt
 *    oldalán maradt teszt-adat) — alias oldja meg.
 *  * A JSON-LD képe `width=1920` paramétert visel (1656 kB/kép); a
 *    `displayImageUrl` normalizálja megjelenítési méretre.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Bluefin",
  baseUrl: "https://bluefinsupboards.eu",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      "notes": "Hivatalos D2C oldal, JSON-LD 8/8 mintan validalva 2026-07-31",
      "excludeUrlPatterns": [
          "/de/",
          "/es/",
          "/fr/",
          "/it/",
          "/nl/"
      ],
      "productUrlPatterns": [
          "paddleboard",
          "paddle-board"
      ]
  },
};
