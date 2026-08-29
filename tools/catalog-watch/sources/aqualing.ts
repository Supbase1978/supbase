/**
 * AQUALING (aqualing.hu) — magyar bolt, a HYDRO-FORCE hiányzó adataiért.
 *
 * MIÉRT KELL, HA MÁR VAN BESTWAY-FORRÁSUNK: a gyártó hivatalos európai boltja
 * (`bestwaystore.de`) ŰRTARTALMAT ÉS DESZKA-SÚLYT nem közöl — a Deszkaválasztó
 * emiatt a Hydro-Force deszkákat a második, független tartalék nélkül
 * pontozza. Ez a bolt viszont KÖZLI mindkettőt, címkézett attribútum-táblában
 * (`Űrtartalom (l)`, `Deszka nettó tömege`), és a méret meg a teherbírás
 * pontosan egyezik a gyártói adattal — vagyis nem másik igazságot ad, hanem
 * kiegészíti azt. A moderátor a jelöltet a meglévő deszkához fésüli.
 *
 * PLUSZBAN ~15 Hydro-Force modellt visz, szemben a gyártói bolt 10-ével
 * (Huaka'i Tech, White Cap, White Cap Convertible, FastBlast Tech, Aqua
 * Wander, Breeze Panorama, Aqua Excursion Tech, Kahawai, Sea Breeze…).
 *
 *  * CSAK A HYDRO-FORCE ÁG: a bolt Gladiatort is árul, de azt a gyártótól
 *    (`gladiatorsup.com`) gyűjtjük — innen csak duplikátum lenne. Az
 *    URL-minta ezért szűk, és mivel egyetlen márkát enged be, a
 *    `defaultBrandName` is biztonságos.
 *  * AZ ATTRIBÚTUM-TÁBLA HÁROM SORBA TÖRDELVE jön: címke, kettőspont, érték
 *    (`Hosszúság (cm)` ⏎ `:` ⏎ `305`). A „következő sor az érték" olvasó
 *    enélkül a kettőspontot vette volna értéknek.
 *  * AZ EGYSÉG A CÍMKÉBEN ÁLL, nem az érték mellett — `Hosszúság (cm)`,
 *    `Max. teherbírás (kg)`, `Űrtartalom (l)`. Ez nem találgatás: a bolt
 *    kiírta, csak máshová.
 *  * `Típus : All-around/Általános` — a bolt SAJÁT besorolása, ezért
 *    `labeledUse`. Mérve: mind a hat próbaoldalon ez adta a kategóriát.
 *  * A `<title>` FIX HOSSZRA VAN VÁGVA, a végén az utótag csonkjával
 *    („… 12 cm - a", „… 274x76x12 cm - aquali"), sőt olykor a méret közepén
 *    („… evezővel 340"). A `titleSuffixes` csonkolt utótagot is levág; a
 *    címben maradt árva méret-szám viszont bennmarad — a modellnév ettől
 *    „FREESOUL TECH 340" lesz, ami egyedi és felismerhető, csak a gyártói
 *    forrás „Freesoul Tech" nevétől eltér. Ezt a moderátor fésüli össze.
 *  * `Max. evezős súly (kg)` — az EVEZŐS megengedett testsúlya, NEM a deszka
 *    tömege. A tartozék-kizárás (`evező` előtag) védi ki; a teherbírást a
 *    `Max. teherbírás (kg)` adja.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Aqualing",
  baseUrl: "https://www.aqualing.hu",
  kind: "shop",
  country: "HU",
  crawlConfig: {
    notes:
      "Magyar bolt, CSAK a Hydro-Force ágról gyűjtünk (a Gladiatort a gyártótól). MIÉRT: a " +
      "gyártó hivatalos boltja űrtartalmat és deszka-súlyt nem közöl, ez a bolt viszont igen, " +
      "címkézett attribútum-táblában — a méret és a teherbírás egyezik a gyártóival. Az " +
      "attribútum-tábla három sorba tördelve jön (címke / kettőspont / érték), és az EGYSÉG A " +
      "CÍMKÉBEN áll. A <title> fix hosszra van vágva, ezért a modellnévben maradhat árva " +
      "méret-szám. A kategóriát a bolt „Típus\" mezője adja (labeledUse).",
    htmlOnly: true,
    minDelayMs: 1500,
    sitemapUrl: "https://www.aqualing.hu/sitemap.xml",
    productUrlPatterns: ["/hydro-force-"],
    excludeUrlPatterns: [
      // Kategória- és gyűjtőoldalak, nem termékek.
      "/sup/",
      "/kiemelt-termekek/",
      "ujdonsag",
    ],
    defaultBrandName: "Hydro-Force",
    titleSuffixes: [" - aqualing.hu"],
    titleNoiseWords: ["hydro force", "hydro-force", "bestway", "evezővel", "aqualing"],
    categoryMethods: ["labeledUse"],
  },
};
