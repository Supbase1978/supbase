/**
 * BLUEFIN (bluefinsupboards.eu)
 *
 *  * A méret néhány termékvonalon CSAK a böngészőben kerül a látható
 *    szövegbe — ez a forrás hívta életre a `render.ts` fallbacket.
 *  * A JSON-LD márkaneve a termékek nagy részén „Bluefin-testing" (a bolt
 *    oldalán maradt teszt-adat) — alias oldja meg.
 *  * A JSON-LD képe `width=1920` paramétert visel (1656 kB/kép); a
 *    `displayImageUrl` normalizálja megjelenítési méretre.
 *  * ŰRTARTALMAT A MÁRKA EGYETLEN MODELLNÉL SEM KÖZÖL (felhasználói
 *    ellenőrzés a gyártó oldalán, 2026-08-21). Nem a kinyerés hibája: méretet
 *    és teherbírást mind a 15 deszkánál megad, űrtartalmat egyiknél sem. Ezért
 *    `unpublishedFields` — így nem marad örökre a hiányos-listán, és a
 *    mezőlefedettségi jelentés sem jelez ott anomáliát, ahol nincs.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Bluefin",
  baseUrl: "https://bluefinsupboards.eu",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      "notes": "Hivatalos D2C oldal, JSON-LD 8/8 mintan validalva 2026-07-31. ŰRTARTALMAT NEM KÖZÖL (2026-08-21, gyártói oldalon ellenőrizve) — a hiányzó térfogat itt nem adathiba.",
      "unpublishedFields": ["volumeL"],
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
