/**
 * ZRAY (zraysports.com)
 *
 *  * Erősen korlátoz (`429 Too Many Requests`) — ezért a 3000 ms szünet.
 *  * Nincs JSON-LD; a spec címkézett, kettősponttal (`Volume: 379L`).
 *  * A termék-URL puszta sorszám (`/productinfo/854740.html`), a leírás nem
 *    mond kategóriát — a besorolás a MORZSAMENÜBŐL jön
 *    (`HOME › EVO COLLECTION › ALL AROUND EVO`).
 *  * KÉTFÉLE OLDALSABLON (2026-08-22). A régebbi modelleknél a morzsamenü ott
 *    van a nyers HTML-ben; az ÚJABBAKNÁL (VIGOUR, SUPER, WINDSURF PRO) csak
 *    JS-futás után jelenik meg — a nyers HTML-ben egyetlen kategória-szó
 *    sincs. A felhasználó a böngészőben mindet látja
 *    (`HOME › Product - Zray | SUP & KAYAK › SUP › Touring › GRAIN 10'8"`),
 *    a crawler viszont nem.
 *
 *    A böngésző-renderelés NEM ellenőrizhető rajta: a forrás agresszíven
 *    korlátoz, és a próba `429 Too Many Requests`-et adott. 4 terméket érint,
 *    ezért a moderátori rögzítés (`boardTypeByUrl`) olcsóbb, mint egy
 *    renderelős menetet építeni rá.
 *  * Az ikonjaihoz HANGUL karaktereket használ, ami az NFD-hajtásnál
 *    index-csúszást okozott: a „Volume: 379L" ablak „9L"-ként indult.
 *  * A cím utótagja minden oldalon `-Zray Official Site`.
 *  * A DESZKA SÚLYÁT egyetlen modellnél sem közli (ellenőrizve 2026-08-22, a
 *    mezőlefedettségi jelentés `súly 0/74` sora nyomán). A termékoldalakon
 *    csak TEHERBÍRÁS szerepel („weight capacity", „Capacity: up to 220kg") —
 *    nettó tömeg sehol. Ezért `unpublishedFields`, nem javítandó hiba.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Zray",
  baseUrl: "https://www.zraysports.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      "notes": "Erősen korlátozott (429 Too Many Requests) — nagy szünet kell. A spec-blokk címkézett, kettősponttal. A DESZKA SÚLYÁT nem közli (2026-08-22, gyártói oldalon ellenőrizve) — csak teherbírást ad.",
      "unpublishedFields": ["weightKg"],
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
