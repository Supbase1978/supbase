/**
 * BESTWAY / HYDRO-FORCE (bestwaystore.de) — a márkatáblázat utolsó hiányzó
 * márkája.
 *
 * A GYÁRTÓNAK NINCS BEJÁRHATÓ D2C OLDALA: a bestway.com/bestwaycorp.com
 * termékkatalógusa nem ad SUP-termékoldalakat spec-táblával. Az EURÓPAI
 * HIVATALOS BOLT viszont igen — a `bestwaystore.de` („Official Bestway®
 * Store", üzemeltető: AWH GmbH), és van teljes ANGOL nyelvi ága is. A
 * `bestwaystore.co.uk` Shopify-bolt ugyanezekkel a termékekkel, de ott a
 * specifikáció csak a marketing-prózában áll (`body_html`), táblázatban nem —
 * ezért a német bolt angol ága a forrás.
 *
 *  * A SITEMAP NYELVENKÉNT KÜLÖN VAN. A `/sitemap.xml` index a NÉMET
 *    URL-eket sorolja (2999 db), és egyetlen `/en/` bejegyzés sincs benne. Az
 *    angol ág saját indexet kap: `/en/sitemap.xml`. A német és az angol slug
 *    NEM egymásból származik (`…-mit-sitz-335-x-91-5-x-15-cm` kontra
 *    `…-with-seat-335-x-91.5-x-15-cm`), tehát nem is lehetne átírni — a jó
 *    sitemapot kell megtalálni.
 *  * NINCS JSON-LD az oldalakon (0 `application/ld+json` blokk), ezért
 *    `htmlOnly`.
 *  * A SPEC A „Product highlights" BLOKKBAN áll, címkézve:
 *    `Inflated size 335 x 91.5 x 15 cm` és `Weight capacity 150 kg`. A
 *    méret-hármas ÖNLEÍRÓ (explicit `cm`), ezért a címke nélküli hármas-minta
 *    kiolvassa; a teherbírást a `capacity` needle fogja meg. Egy modellnél a
 *    címke duplázódik (`Weight capacity weight : 160 kg`) — ez nem zavar.
 *  * AZ URL-MINTA EGYBEN SZŰRŐ IS: a boltban ~55 Hydro-Force PÓTALKATRÉSZ van
 *    (`/en/bestway-spare-part-…`, köztük „replacement board" tételek, amik a
 *    nevükben deszka-méretet viselnek!), a deszkák viszont kivétel nélkül
 *    `/en/hydro-force-sup-…` alatt élnek. A szűk minta ezért strukturálisan
 *    zárja ki a pótalkatrészeket — nem a `classifyProduct`-ra bízzuk.
 *  * A KATEGÓRIA AZ URL-BEN ÉS A NÉVBEN van (`…-allround-board-set-…`,
 *    `…-touring-board-set-…`), tehát a `nameAndUrl` módszer elég.
 *
 * ŰRTARTALMAT ÉS DESZKA-SÚLYT NEM KÖZÖL (2026-08-29, négy termékoldalon
 * ellenőrizve: egyik lapon sem szerepel „volume"/„litre", és a „Technical
 * data" blokk csak árukategóriát ad). A gyártó a műszaki adatlapot PDF-ben
 * teszi közzé, azt viszont a `robots.txt` PDF-tiltó szabálya kizárja — és
 * PDF-et amúgy sem olvasunk. A hiány tehát VÁRT, nem kinyerési hiba.
 *
 * ÉLESBEN MÉRT CSAPDA, AMI NEM A FORRÁSÉ: az egyik termékoldal első
 * letöltése CSONKA válasz volt (79 kB a 820 helyett, egy `href="…` attribútum
 * közepén elvágva). A kinyerés ettől NEM üresen tért vissza: a méretet a
 * CÍMBŐL még kiolvasta, a teherbírás viszont némán üresen maradt — vagyis egy
 * hihetőnek látszó, féladatos sor. Ha egy lap váratlanul kevesebb mezőt ad,
 * mint a többi, ELŐSZÖR töltsd le újra.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Bestway",
  baseUrl: "https://www.bestwaystore.de",
  // A gyártónak nincs bejárható D2C oldala; ez a hivatalos európai bolt.
  kind: "shop",
  country: "EU",
  crawlConfig: {
    notes:
      "Bestway / Hydro-Force a hivatalos európai boltból, az ANGOL nyelvi ágról. A sitemap " +
      "nyelvenként külön van: a /sitemap.xml a német URL-eket sorolja, az angolt a " +
      "/en/sitemap.xml. Nincs JSON-LD (htmlOnly). A spec a „Product highlights\" blokkban áll " +
      "(Inflated size + Weight capacity). ŰRTARTALMAT ÉS DESZKA-SÚLYT NEM KÖZÖL " +
      "(2026-08-29, négy termékoldalon ellenőrizve; a műszaki adatlap PDF, amit a robots.txt tilt). " +
      "Az URL-minta zárja ki a ~55 pótalkatrészt, köztük a nevükben deszka-méretet viselő " +
      "„replacement board\" tételeket.",
    htmlOnly: true,
    minDelayMs: 1500,
    sitemapUrl: "https://www.bestwaystore.de/en/sitemap.xml",
    productUrlPatterns: ["/en/hydro-force-sup-"],
    defaultBrandName: "Hydro-Force",
    // A cikkszám a cím végén, függőleges vonal után („… 15 cm | 6532D_26").
    titleCutAfter: ["|"],
    // FORRÁS-SZINTŰ zaj: a márkanév kétféle írásmóddal (a `defaultBrandName`
    // csak a sajátjával egyezik), és a KATEGÓRIA-szavak, amiket amúgy is
    // külön mezőben tárolunk (`board_types`). Enélkül a modellnév
    // „Allround Board Aqua Journey" lenne, a típus pedig kétszer szerepelne.
    // A „with seat" CSOMAGOLÁSI változat, nem másik deszka: a moderátor mérte,
    // hogy az üléses és ülés nélküli modell specifikációja MEGEGYEZIK
    // (2026-08-31) — az ülés tartozék, nem konstrukció. A névben hagyva két
    // katalógus-sor születne ugyanarra a deszkára.
    titleNoiseWords: [
      "with seat",
      "hydro force",
      "hydro-force",
      "bestway",
      "allround",
      "all round",
      "all-round",
      "touring",
      "recreation leisure",
      "board",
    ],
    categoryMethods: ["nameAndUrl"],
    unpublishedFields: ["volumeL", "weightKg"],
  },
};
