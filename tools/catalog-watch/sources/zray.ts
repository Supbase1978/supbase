/**
 * ZRAY (zraysports.com)
 *
 *  * Erősen korlátoz (`429 Too Many Requests`) — ezért a 3000 ms szünet.
 *  * Nincs JSON-LD; a spec címkézett, kettősponttal (`Volume: 379L`).
 *  * A termék-URL puszta sorszám (`/productinfo/854740.html`), a leírás nem
 *    mond kategóriát — a besorolás a MORZSAMENÜBŐL jön
 *    (`HOME › EVO COLLECTION › ALL AROUND EVO`).
 *  * Az ikonjaihoz HANGUL karaktereket használ, ami az NFD-hajtásnál
 *    index-csúszást okozott: a „Volume: 379L" ablak „9L"-ként indult.
 *  * A cím utótagja minden oldalon `-Zray Official Site`.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Zray",
  baseUrl: "https://www.zraysports.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      "notes": "Erősen korlátozott (429 Too Many Requests) — nagy szünet kell. A spec-blokk címkézett, kettősponttal.",
      "htmlOnly": true,
      "minDelayMs": 3000,
      "titleSuffixes": [
          "-Zray Official Site"
      ],
      "defaultBrandName": "Zray",
      "productUrlPatterns": [
          "/productinfo/"
      ]
  },
};
