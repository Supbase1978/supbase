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
      ]
  },
};
