/**
 * FANATIC (fanatic.com) — a legösszetettebb forrásunk.
 *
 * Amit a bekötés megtanított (F2.1-utó-35):
 *  * NEM a Duotone alatt van, hiába így hozza a márkalista — saját oldal;
 *  * a termék-sitemap a sitemap-index 14. bejegyzése, nem az első pár között;
 *  * a termékkártyák NEM linkek (JS-kattintás) — az URL-mintát böngészővel
 *    kattintva derítettük ki;
 *  * a `SIZES AND SPECS` tábla KIZÁRÓLAG renderelés + görgetés után létezik,
 *    ezért kell a `renderWhenEmpty` (a nyers HTML semmit nem ad);
 *  * a JSON-LD kitesz nevet és árat, de EGYETLEN méretet sem — ezért ÜT rajta
 *    a `htmlOnly`;
 *  * EGY oldal a modellcsalád MINDEN méretét hozza → méretenkénti bontás;
 *  * a cím szlogent visel („… ᐅ your all-round kids inflatable SUP!"), ami
 *    termékenként más — ezért `titleCutAfter`, nem `titleSuffixes`;
 *  * a kategória a termékfejlécben áll (`product-overview__line`), és a
 *    felirat SORRENDJE dönt: „TOURING / FREERACING" → túra, nem race.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Fanatic",
  baseUrl: "https://www.fanatic.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      // MÉRVE (2026-08-22, fixtúra-mátrix): itt CSAK a `categoryLine` ad
      // találatot — a gyártó saját felirata a termékfejlécben.
      // A `multiUseProse` SZÁNDÉKOSAN kimarad: ennek a forrásnak a prózájában
      // tévedett („the new touring sensation especially in choppy waters or
      // rivers" → vadvízi deszka lett volna egy túradeszkából).
      "categoryMethods": ["pinnedUrl", "categoryLine", "nameAndUrl"],
      // GALÉRIA (F2.1-utó-56): A termékgaléria bélyegkép-csíkja — 5 kép (felül-alul nézet, akciófotó, uszony, hordszíj).
      galleryClass: "thumbnails-carousel",
      "notes": "Nincs JSON-LD; a SIZES AND SPECS tábla CSAK böngésző-renderelés + görgetés után létezik. Egy oldal a modellcsalád MINDEN méretét hozza — méretenkénti bontással.",
      "htmlOnly": true,
      "sitemapUrl": "https://www.fanatic.com/__sitemap__/products-eu-en-0.xml",
      "categoryClass": "product-overview__line",
      "titleCutAfter": [
          "ᐅ"
      ],
      "renderWhenEmpty": true,
      "defaultBrandName": "Fanatic",
      "productUrlPatterns": [
          "fanatic-isup-",
          "fanatic-sup-"
      ]
  },
};
