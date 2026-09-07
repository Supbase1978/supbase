/**
 * JOBE (jobesports.com)
 *
 *  * A `/sitemap.xml` 404-et ad; a használható út a `sitemap_index.xml` →
 *    `sitemap_en.xml` (3044 URL). A `probe` ezt nem találta meg magától.
 *  * A minta `-sup-`, NEM `sup-board`: utóbbi kihagyta volna az egész Lite
 *    szériát (`…-sup-lite-board-…`).
 *  * A méret KETTŐS írásmódú, kevert egységgel:
 *    `8'6" x 28" x 4,75" | 2,59m x 71,12cm x 12cm`.
 *  * Teherbírást SEHOL nem ír, csak `Recommended rider weight` — felhasználói
 *    döntés (2026-08-20): ezt vesszük teherbírásnak, mert konzervatív.
 *  * A képfájlok a CIKKSZÁMOT viselik, ami az URL végén is ott van — ez a
 *    legerősebb kép-horgony, és ezzel a GALÉRIA is gyűjthető.
 *  * KÉT cím-sablon él az oldalon, ezért két utótag kell.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Jobe",
  baseUrl: "https://www.jobesports.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      // MÉRVE: a Jobe-nál a kategória KIZÁRÓLAG a prózában van — se
      // kategória-felirat, se morzsamenü, se használat-sáv. A gyártó kettőt is
      // kimond: „Ideal for both all-around paddling and touring".
      "categoryMethods": ["pinnedUrl", "nameAndUrl", "multiUseProse"],
      "notes": "Nincs JSON-LD; a spec címkézett szövegként. A cikkszám az URL végén = a képfájlok neve. Teherbírás = Recommended rider weight (felhasználói döntés, 2026-08-20).",
      "htmlOnly": true,
      "sitemapUrl": "https://www.jobesports.com/sitemap_en.xml",
      "titleSuffixes": [
          " | Shop now at Jobesports.com",
          " - Jobesports.com"
      ],
      "defaultBrandName": "Jobe",
      "productUrlPatterns": [
          "-sup-",
          "paddle-board"
      ],
      // A HÍREK ROVAT a `-sup-` mintára illeszkedik (élesben mérve, 2026-09-06:
      // `/en/newsflash/introducing-the-sup-concept-series-3019/`). Egy cikk
      // sosem termék: a kinyerés 23 cm „hosszt" talált a prózában, és a
      // moderátornak kellett elutasítania. A kizáró minta erősebb, mint a
      // befoglaló, ezért a rovat egésze kiesik.
      "excludeUrlPatterns": [
          "/newsflash/"
      ],
      // A SZÍNVÁLTOZAT NEM KÜLÖN MODELL (moderátori jegyzetek, 2026-09-06).
      // A Jobe címsablonja `… Package <Szín>` alakú — a szín MINDIG a végén,
      // a csomag-szó után áll —, és ugyanaz a deszka két-három színnel is
      // szerepel a sitemapben: `Aero Yarra … Package Purple` és
      // `… Package Steel Blue` egyetlen modell. A szín a névből kimarad, amíg
      // a `boards.colors` mező meg nem születik (halasztott fejlesztési tétel);
      // addig a duplikátum-felismerés is így fésüli össze őket.
      // A SORREND SZÁMÍT: a „steel blue" a „blue" ELŐTT áll, különben árva
      // „Steel" maradna a névben.
      "titleNoiseWords": [
          "steel blue",
          "blues",
          "purple",
          "blue"
      ]
  },
};
