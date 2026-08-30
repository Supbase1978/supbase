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
      // MÉRVE: a rögzítés (a gyártó SUP-taxonómiája) és a morzsamenü. Prózás
      // módszer nem kell: a Zray leírásai a SZOMSZÉD termékekről is írnak
      // („Related Products"), ott a mondat-szintű minta is félrevezethet.
      "categoryMethods": ["pinnedUrl", "breadcrumb", "nameAndUrl"],
      // GALÉRIA (F2.1-utó-56): A sablon nagykép-listája — 5 kép; a bélyegkép-változatokat az útvonal-azonosság szűri.
      galleryClass: "w-bigimglist",
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
      ],
      // A GYÁRTÓ SAJÁT TAXONÓMIÁJA (2026-08-22, böngészővel kiolvasva a
      // `/ProductInfoCategory?categoryId=…` oldalakról). A SUP-menü nyolc
      // alkategóriára bomlik: All Around · Touring · Multi-purpose · Vigour ·
      // Racing · Windsurfing · Bodyboarding · Specialty.
      //
      // Erre azért volt szükség, mert az ÚJABB termékoldalakon a morzsamenü
      // csak JS-futás után jelenik meg — a crawler nem látja. A moderátori
      // rögzítés ezt hidalja át, és nem kell hozzá rendereléses menet.
      //
      // A LEKÉPEZÉS INDOKLÁSA, ahol nem magától értetődő:
      //  * `Multi-purpose` → allround: a gyártó „univerzális" vonala.
      //  * `Vigour` → yoga: a saját leírása szerint „balance training…
      //    the ideal collection for FITNESS AND YOGA enthusiasts". A
      //    kollekció DOCK és AIRMAT tagja NEM deszka (nem evezik) — azok a
      //    `NEVER_BOARD_KEYWORDS` listán esnek ki.
      //  * `Windsurfing` → allround: felhasználói döntés (2026-08-22) szerint
      //    a windsurf-deszka marad; sík vízen evezik, mint a Fanatic Viper
      //    Airt (a gyártó ott `ALL-AROUND / WINDSURF`-öt ír).
      //  * `Specialty` SUPER 17' → allround: 518×152 cm, 1280 L,
      //    többszemélyes csapatdeszka — ugyanaz a kezelés, mint az Aqua
      //    Marina Megáé.
      //  * `Bodyboarding` SZÁNDÉKOSAN nincs itt: az nem SUP.
      //
      // A gyűjtő-landolóoldalak (RIVER, TOURING AIR, race, SPECIALTY VISTA)
      // sincsenek itt: azok kategória-lapok termékoldal-URL-en, nem modellek.
      "boardTypeByUrl": {
          "/productinfo/854723.html": "allround",
          "/productinfo/857099.html": "allround",
          "/productinfo/1094329.html": "allround",
          "/productinfo/1096995.html": "allround",
          "/productinfo/1100061.html": "allround",
          "/productinfo/854726.html": "touring",
          "/productinfo/1095323.html": "touring",
          "/productinfo/1101854.html": "touring",
          "/productinfo/1100131.html": "touring",
          "/productinfo/1100182.html": "touring",
          "/productinfo/854740.html": "allround",
          "/productinfo/854743.html": "allround",
          "/productinfo/856029.html": "allround",
          "/productinfo/854737.html": "allround",
          "/productinfo/1102148.html": "yoga",
          "/productinfo/1095614.html": "race",
          "/productinfo/1095552.html": "race",
          "/productinfo/1095362.html": "allround",
          "/productinfo/1095541.html": "allround",
          "/productinfo/1105656.html": "allround",
          "/productinfo/856036.html": "allround"
      }
  },
};
