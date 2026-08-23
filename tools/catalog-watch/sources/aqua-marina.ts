/**
 * AQUA MARINA (aquamarina.com) — gyártói oldal
 *
 *  * Nincs JSON-LD; a spec TRANSZPONÁLT tábla (címkék egy oszlopban, alattuk
 *    az értékek): `PRODUCT / MODEL / NET WEIGHT / LENGTH / … / MAX. PAYLOAD`.
 *  * A `MAX. PAYLOAD` fontot ÉS kilogrammot is kiír („308 lbs / 140 kg") —
 *    ezért kötelező a `kg` a mintában, különben a 308 nyerne.
 *  * A gyártó minden deszkát PONTOZ négy használati mód szerint (százalékos
 *    sávok) — ebből jön a kategória, ha a név és az URL nem árulkodik.
 *  * A `boardTypeByUrl` a Revolutionre vonatkozik: a leírása körülír, de
 *    kategória-szót nem használ (moderátori döntés, 2026-08-19).
 *  * A képfájlnevek NEM megbízhatók: a Revolutionnél elgépelés
 *    (`revolutiobn.png`), a Peace és a Dock hero-képének a neve pedig FEL VAN
 *    CSERÉLVE. A pozíció viszont helyes — ezért van pozíció-fallback.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Aqua Marina (gyártói)",
  baseUrl: "https://aquamarina.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      // MÉRVE: a gyártó SAJÁT használat-sávjai (ALL-AROUND 100% / GUIDE 60% /
      // SURF 70% / RACE 30%) a jellemző jel, mellette a kategória-URL. A
      // `multiUseProse` kimarad: ez a gyártó nem kettős mondatokban fogalmaz,
      // a sávok pontosabbak nála.
      "categoryMethods": ["pinnedUrl", "nameAndUrl", "usageBars", "prose"],
      "notes": "Gyártói oldal, nincs JSON-LD; a specifikáció címkézett szövegként (NET WEIGHT / MAX. PAYLOAD). Oldalanként egy deszka, a színváltozatok külön URL-en.",
      "htmlOnly": true,
      "minDelayMs": 1500,
      "sitemapUrl": "https://aquamarina.com/wp-sitemap-posts-page-1.xml",
      "boardTypeByUrl": {
          "/products/revolution/": "allround"
      },
      "defaultBrandName": "Aqua Marina",
      "productUrlPatterns": [
          "/products/"
      ]
  },
};
