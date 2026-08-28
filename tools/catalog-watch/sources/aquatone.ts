/**
 * AQUATONE (aquatone.com) — gyártói oldal, sitemap NÉLKÜL
 *
 * A DOMAIN ITT IS SZÁMÍT: a márkatáblázatban `aquatoneair.com` szerepel, ami
 * DNS-ből sem oldódik fel — emiatt írtuk le korábban a márkát. Az élő oldal a
 * `aquatone.com`.
 *
 *  * NINCS `robots.txt` ÉS NINCS SITEMAP. Mindkét út (és a `sitemap_index`,
 *    `sitemap.txt` is) 200-zal felel, de a tartalmuk egy 1,5 kB-os kínai
 *    hibaoldal (`系统发生错误`). Ez nem tiltás, hanem hiány: a szabvány
 *    szerint robots.txt hiányában a bejárás megengedett.
 *  * A TERMÉKLISTA JS-BŐL ÉPÜL, de a mögötte álló végpont sima GET-tel is
 *    kiszolgál: `/index.php/Products/getList.html?…&cateid=N` HTML-töredéket
 *    ad a `details.html?id=N` linkekkel. A bolt SAJÁT listáját kérjük le,
 *    ugyanazt, amit a böngésző — az ID-tér végigpróbálása lenne a kerülőút.
 *  * A KATEGÓRIÁK: `cateid=24` a BOARDS (a menüben ez a `/products/`), `35`
 *    további SUP-modelleket és kiegészítőket vegyesen. A nem-deszkákat a
 *    `classifyProduct` kapuja szűri, nem az URL-minta.
 *  * A SPEC-TÁBLA kétoszlopos, a címke és az érték külön sorban, KETTŐS
 *    írásmóddal: `LENGTH / 10'6" / 320 cm`, `WEIGHT / 6.8 kg / 15 lbs`.
 *  * ÉLESBEN MÉRT CSAPDA: a terhelési sorokat a gyártó ESCAPE-ELÉS NÉLKÜLI
 *    „kisebb mint" jellel írja — `<p>< 75 kg / 165 lbs</p>`. A naiv
 *    tag-eltávolítás ezt EGY tagnek vette, és a teherbírás nyomtalanul
 *    eltűnt, pedig ott volt a letöltött HTML-ben.
 *  * TEHERBÍRÁS: a lap KÉT terhelési sort ad, `REC. PAYLOAD` elöl és
 *    `MAX. PAYLOAD` utána. A `MAX` kerül be (felhasználói döntés,
 *    2026-08-28: „szinte mindenütt a maximális terhelést írtuk be") — a
 *    katalógus többi sorával csak így összemérhető. A címke-kereső
 *    alapból az ELSŐ találatot venné, ezért a `max. payload` needle
 *    ELŐBBRE került a `payload`-nál a `SPEC_LABELS`-ben.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Aquatone",
  baseUrl: "https://aquatone.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
    notes:
      "Gyártói oldal sitemap NÉLKÜL (a robots.txt és minden sitemap-út hibaoldalt ad). " +
      "A terméklistát a bolt saját getList végpontja adja, kategóriánként. A spec kétoszlopos, " +
      "kettős írásmóddal; a terhelési sorok escape-eletlen < jelet viselnek. Teherbírásnak a " +
      "MAX. PAYLOAD kerül be teherbírásnak (a REC. sor áll elöl, de a katalógus többi " +
      "sorával a maximum az összemérhető).",
    htmlOnly: true,
    minDelayMs: 1500,
    productListUrls: [
      // BOARDS (a menüben `/products/`)
      "https://aquatone.com/index.php/Products/getList.html?setting_id=&level_id=&weight_id=&capacity_id=&price_id=&category_id=&cateid=24",
      // további SUP-modellek, kiegészítőkkel vegyesen
      "https://aquatone.com/index.php/Products/getList.html?setting_id=&level_id=&weight_id=&capacity_id=&price_id=&category_id=&cateid=35",
    ],
    productUrlPatterns: ["details.html?id="],
    defaultBrandName: "Aquatone",
  },
};
