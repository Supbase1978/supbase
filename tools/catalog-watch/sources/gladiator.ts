/**
 * GLADIATOR (gladiatorsup.com)
 *
 *  * Nincs JSON-LD; a spec KÉTOSZLOPOS tábla, MÉRTÉKEGYSÉG NÉLKÜL
 *    (`Volume` / `245`) — az egységet a mező adja.
 *  * A méret-sor CIRILL szorzójelet használ (`354 х 86 х 15`), és a címkéje
 *    zárójeles magyarázatot visel (`Dimensions (length/width/thickness)`).
 *    Mindkettő HAMIS adatot okozott, mielőtt javítottuk.
 *  * A morzsamenüjük a KIVITELI vonalat adja (`Home › Collection › Elite`),
 *    nem a használatot — ezért NEM abból jön a kategória.
 *  * A használati kategória külön taxonómiában él
 *    (`/catalog_activity/{all-round,turizm,sport}/`), és a kategória-oldalak
 *    JS-ből épülnek. A `boardTypeByUrl` alábbi listája ONNAN származik,
 *    böngészővel kiolvasva: 57 EGYÉRTELMŰ termék. A több kategóriába is
 *    besorolt 25 termék SZÁNDÉKOSAN kimaradt — ott a gyártó sem dönt.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Gladiator",
  baseUrl: "https://gladiatorsup.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      "notes": "Nincs JSON-LD; kétoszlopos spec-tábla mértékegység nélkül. A méret-sor CIRILL szorzójelet használ. A kategória a gyártó catalog_activity taxonómiájából rögzítve (all-round/turizm/sport); a TÖBB kategóriába sorolt termékek szándékosan kimaradtak.",
      "htmlOnly": true,
      "sitemapUrl": "https://gladiatorsup.com/wp-sitemap-posts-catalog-1.xml",
      "boardTypeByUrl": {
          "/catalog/one-kd/": "allround",
          "/catalog/pro-10-6/": "allround",
          "/catalog/pro-10-8/": "allround",
          "/catalog/pro-11-2/": "allround",
          "/catalog/pro-11-4/": "allround",
          "/catalog/pro-11-6/": "allround",
          "/catalog/elite-11-2/": "allround",
          "/catalog/elite-11-4/": "allround",
          "/catalog/elite-11-6/": "allround",
          "/catalog/fishing-126/": "touring",
          "/catalog/origin-10-6/": "allround",
          "/catalog/origin-10-8/": "allround",
          "/catalog/one-red-10-8/": "allround",
          "/catalog/one-red-11-4/": "allround",
          "/catalog/one-red-12-6/": "touring",
          "/catalog/one-lime-10-8/": "allround",
          "/catalog/one-lime-11-4/": "allround",
          "/catalog/one-lime-12-6/": "touring",
          "/catalog/one-white-10-8/": "allround",
          "/catalog/one-white-11-4/": "allround",
          "/catalog/one-white-12-6/": "touring",
          "/catalog/origin-10-8-sc/": "allround",
          "/catalog/gladiator-kd-9-6/": "allround",
          "/catalog/gladiator-or10-4/": "allround",
          "/catalog/gladiator-or10-6/": "allround",
          "/catalog/gladiator-or10-8/": "allround",
          "/catalog/gladiator-kd-10-6/": "allround",
          "/catalog/gladiator-or12-6t/": "touring",
          "/catalog/gladiator-15-2-duo/": "touring",
          "/catalog/summit-sport-14x24/": "race",
          "/catalog/summit-sport-14x26/": "race",
          "/catalog/summit-sport-14x28/": "race",
          "/catalog/gladiator-or10-6-sc/": "allround",
          "/catalog/gladiator-or10-8-sc/": "allround",
          "/catalog/gladiator-pro-12-6-s/": "race",
          "/catalog/gladiator-pro-12-6-t/": "touring",
          "/catalog/gladiator-pro-12-6-w/": "touring",
          "/catalog/gladiator-elite-12-6-r/": "race",
          "/catalog/gladiator-elite-12-6-s/": "race",
          "/catalog/gladiator-elite-12-6-t/": "touring",
          "/catalog/gladiator-elite-14-0-r/": "race",
          "/catalog/gladiator-elite-14-0-s/": "race",
          "/catalog/gladiator-elite-14-0-t/": "touring",
          "/catalog/gladiator-elite-kd-10-6-r/": "race",
          "/catalog/gladiator-elite-kd-11-6-r/": "race",
          "/catalog/gladiator-pro-22-0-dragon/": "race",
          "/catalog/gladiator-pro-17-0-big-sup/": "touring",
          "/catalog/gladiator-elite-12-6r-without-a-paddle/": "race",
          "/catalog/gladiator-elite-14-0r-without-a-paddle/": "race",
          "/catalog/gladiator-elite-kd-11-6r-without-a-paddle/": "race",
          "/catalog/fojlbord-naduvnoj-gladiator-foil-137l-62x30x12cm/": "race",
          "/catalog/fojlbord-naduvnoj-gladiator-foil-185l-72x34x12-cm/": "race",
          "/catalog/fojlbord-naduvnoj-gladiator-foil-100l-54x-25x-12cm/": "race",
          "/catalog/vingfojlbord-naduvnoj-gladiator-foil-150l-66x30x12-cm/": "race",
          "/catalog/vingfojlbord-naduvnoj-gladiator-foil-125l-510x29x12-cm/": "race",
          "/catalog/vingfojlbord-naduvnoj-gladiator-foil-112l-57x-29-5x-12cm/": "race",
          "/catalog/fojlbord-naduvnoj-gladiator-foil-lightwind-138l-74x-21-5x15-cm/": "race"
      },
      "defaultBrandName": "Gladiator",
      "productUrlPatterns": [
          "/catalog/"
      ]
  },
};
