/**
 * ROC Outdoors (rocoutdoors.com) — amerikai gyártó, Shopify-bolton
 * (F2.1-utó-58, 2026-09-01).
 *
 * Amit a bekötés megtanított:
 *
 *  * **A SPECIFIKÁCIÓ A SOROZAT LEÍRÁSÁBAN ÁLL, nem a termékoldalon** — ez a
 *    forrás fő tanulsága, és ezért született a `seriesTextByUrl`. A gyártó a
 *    sorozat minden tagját ugyanabban a méretben árulja, csak a színük tér el,
 *    ezért az adatot EGYSZER írja le, a kollekció leírásában:
 *      „The Explorer series boards … are 10' tall, 32 inches wide with a
 *       weight capacity of 350 pounds."
 *    A `10' Explorer` termékoldala TEHERBÍRÁST SEHOL nem közöl (a teljes
 *    HTML-ben nincs `capacity` szó a leíráson kívül), a négy `10' Scout`
 *    színváltozat lapjáról pedig még a VASTAGSÁG is hiányzik. Teherbírás
 *    nélkül a deszka a moderációs sorban ragad, és a Deszkaválasztó sem
 *    ajánlja — vagyis a gyártó KÖZLI az adatot, csak nem ott, ahol kerestük.
 *
 *  * **A KOLLEKCIÓ HTML-LAPJA ERRE ALKALMATLAN.** A `/collections/
 *    explorer-series` lapján a TÖBBI sorozat leírása is ott áll (mérve: a
 *    Scout „10' tall, 33 inches wide…" mondata ugyanazon a lapon) — a szövege
 *    hozzáfűzve a SZOMSZÉD sorozat méretét szórná be. A recept ezért a
 *    `/collections/<slug>.json` címre mutat: egyetlen kérés, pontosan egy
 *    `description` mező.
 *
 *  * **SPEC-TÁBLA EGYÁLTALÁN NINCS.** A méret kizárólag a leírás egyetlen
 *    mondatában áll, MELLÉKNÉVI alakban, az érték a címkéje ELŐTT:
 *    `At 10' tall, 32" wide, and 6" thick` (Explorer, Horizon),
 *    `Measuring 10' 6" long by 33" wide and with a thickness of 6"` (Kahuna,
 *    Cruiser), `Measuring 10'6" long and 33" wide` (Abyss). A `wide` már
 *    címke volt, a `tall`/`long`/`thick` nem — mind a hat modellnél HIÁNYZOTT
 *    A HOSSZ, ami kizáró mező: a forrás NULLA terméket adott volna. Ezt a
 *    `parseProseDimensionChain` oldja meg (a `thick` puszta címkeként
 *    mérhetően elrontja a Jobe-t, ezért ALAKZAT védi: hossz + szélesség
 *    tagnak egymás után kell állnia).
 *
 *  * **A `<title>` FELOLDATLAN ENTITÁST visel**: `10' Explorer &ndash; ROC
 *    Outdoors`. A `htmlToText` feloldja, tehát a `titleSuffixes` a valódi
 *    gondolatjeles alakra (` – ROC Outdoors`) írandó. A Horizon-lapokon KÉT
 *    gondolatjel van (`Horizon – Celestial – ROC Outdoors`) — a színnév a
 *    modellnévben marad, ld. lent.
 *
 *  * **A `<title>` a lap ELSŐ `<title>`-je, de TÖBB TUCAT van belőle**: a
 *    SVG-ikonok saját `<title>` elemet viselnek (`Facebook`, `Toggle menu`,
 *    `Visa`). A soron belüli grep emiatt félrevezet — a valódi cím TÖBB SORBA
 *    tördelve áll a `<head>`-ben, tehát elöl. A kinyerő `[\s\S]*?` mintája jól
 *    veszi; ez a jegyzet a KÉZI ellenőrzésnek szól.
 *
 *  * **A SZÍNVÁLTOZATOK KÜLÖN TERMÉKEK.** A Horizon hat, a Scout négy külön
 *    `/products/…` címen él (`10-6-horizon-celestial`, `…-canopy`, …), azonos
 *    specifikációval. A bejárás így 14 jelöltet ad hat modellre. Ezeket NEM a
 *    crawler vonja össze — a moderátor dolga (Összefésülés), a `boards.colors`
 *    mező pedig még nyitott fejlesztési tétel.
 *
 *  * **AMIT A GYÁRTÓ NEM KÖZÖL.** Űrtartalmat EGYETLEN modellnél sem
 *    (2026-09-01, mind a 14 termékoldalon és mind a hat kollekció-leírásban
 *    ellenőrizve) — ezért `unpublishedFields`.
 *
 *  * **TEHERBÍRÁST KÉT MODELLNÉL NEM AD**: a `10'6" Cruiser` kollekciójának
 *    (`cruiser-series`) egyáltalán NINCS leírása, a `horizon-series` leírása
 *    pedig a méretet kiírja, a teherbírást nem. A termékoldalukon sincs.
 *    Ez NEM `unpublishedFields`: a márka a másik négy modellnél KÖZLI
 *    (350 pounds), tehát forrás-szintű hiányként deklarálni hazugság lenne —
 *    a mezőlefedettségi sor `teher 12/14`-e a helyes, moderátori döntést kérő
 *    állapot.
 *
 *  * **A SÚLYT KÖZLI, DE KINYERHETETLEN PRÓZÁBAN**: „each board weighs only
 *    18 pounds" (Kahuna, Cruiser) és „remaining impressively lightweight at
 *    just 18 pounds" (Horizon). A két fordulatnak nincs közös, szűk alakja,
 *    és a „18 pounds" a lap más állításai mellett is megáll — mintát írni rá
 *    találgatás lenne. Szintén nem `unpublishedFields`: a gyártó közli, mi
 *    nem tudjuk biztonságosan kiolvasni.
 *
 *  * **A KATEGÓRIA a gyártónál nincs lebontva.** Egyetlen deszka-kollekciója
 *    van (`roc-inflatable-paddle-boards`), morzsamenüje nem mond kategóriát, a
 *    leírásai pedig FELSOROLNAK („fitness, yoga, long distance paddling, light
 *    surfing, fishing or just floating in the sun") — a skill szabálya szerint
 *    a kötőszóval sorolt kategóriák egyike sem A kategória. Mind a hat modell
 *    10'–10'6" × 32–33" méretű, kezdőknek és családoknak ajánlott
 *    rekreációs deszka, tehát `allround`; a rögzítés `boardTypeByUrl`-ben.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "ROC Outdoors",
  baseUrl: "https://www.rocoutdoors.com",
  kind: "brand_site",
  country: "US",
  crawlConfig: {
    notes:
      "Shopify-bolt spec-tábla NÉLKÜL: a méret a leírás egyetlen mondatában áll, melléknévi alakban (10' tall, 32\" wide, 6\" thick), a TEHERBÍRÁS pedig a SOROZAT kollekció-leírásában — a termékoldalon sehol. Ezért htmlOnly + seriesTextByUrl. A kollekció HTML-lapja NEM használható forrásnak: rajta a TÖBBI sorozat leírása is ott áll, ezért a /collections/<slug>.json a cím. ŰRTARTALMAT NEM KÖZÖL (2026-09-01, mind a 14 termékoldalon ellenőrizve). A Cruiser és a Horizon TEHERBÍRÁST nem ad (a cruiser-series kollekciónak nincs leírása, a horizon-series-é a teherbírást kihagyja) — ez a két modell moderátori döntést kér. A súlyt (18 pounds) közli, de kinyerhetetlen prózában. A Horizon 6, a Scout 4 SZÍNVÁLTOZATA külön termékoldal, azonos speckel — összefésülés a moderátoré.",
    htmlOnly: true,
    // A sitemap-INDEX, nem a gyerek: a Shopify a `sitemap_products_1.xml`-t
    // aláírás-paraméterekkel (`?from=…&to=…`) szolgálja ki, és azok
    // változnak. Az indexből mindig a friss alak jön (ugyanaz a csapda,
    // amit a FunWaternél mértünk).
    sitemapUrl: "https://www.rocoutdoors.com/sitemap.xml",
    // A 32 URL-es sitemapben a deszkák NEM viselnek közös szegmenst
    // (`/products/kahuna`, `/products/10-6-horizon-celestial`), ezért a minta
    // modellcsaládonként sorol. Ez STRUKTURÁLIS szűrő: a kiegészítők
    // (`/products/manual-pump-explorer-scout`, `/products/backpack`,
    // `/products/safety-leash`) egyik előtag alá sem esnek — a
    // pumpa-URL az „explorer" szót VISELI, a `/products/explorer` előtagot
    // viszont nem.
    productUrlPatterns: [
      "/products/explorer",
      "/products/kahuna",
      "/products/cruiser",
      "/products/10-6-horizon-",
      "/products/10-scout-",
      "/products/10-6-abyss-",
    ],
    defaultBrandName: "ROC",
    // A `&ndash;` a nyers HTML-ben entitás, a `htmlToText` UTÁN gondolatjel —
    // az utótagot a feloldott alakra kell írni.
    titleSuffixes: [" – ROC Outdoors"],
    // A SOROZAT LEÍRÁSA. A kulcs URL-részlet, a cím a Shopify kollekció-JSON:
    // pontosan egy `description` mező, egyetlen kéréssel. Csak ott áll, ahol
    // MÉRHETŐEN ad valamit a termékoldalon felül:
    //   * explorer-series → teherbírás (a lapon sehol);
    //   * scout-series    → vastagság ÉS teherbírás (a lapon egyik sincs);
    //   * kahuna          → teherbírás.
    // A `cruiser-series`-nek NINCS leírása, a `horizon-series` pedig csak a
    // termékoldalon már meglévő méretet ismétli — azokra kérést indítani
    // ingyen sem érne semmit.
    seriesTextByUrl: {
      "/products/explorer": "https://www.rocoutdoors.com/collections/explorer-series.json",
      "/products/10-scout-": "https://www.rocoutdoors.com/collections/scout-series.json",
      "/products/kahuna": "https://www.rocoutdoors.com/collections/kahuna.json",
    },
    // A gyártó nem bontja kategóriákra a kínálatát (EGY deszka-kollekció, a
    // leírások felsorolnak). Mind a hat modell 10'–10'6" × 32–33", kezdőknek
    // és családoknak ajánlott rekreációs deszka. A színváltozatokat egy-egy
    // előtag fogja össze (a `boardTypeByUrl` RÉSZSTRINGET illeszt).
    boardTypeByUrl: {
      "/products/explorer": "allround",
      "/products/kahuna": "allround",
      "/products/cruiser": "allround",
      "/products/10-6-horizon-": "allround",
      "/products/10-scout-": "allround",
      "/products/10-6-abyss-": "allround",
    },
    // MÉRVE (2026-09-01, probe-methods): a gyártó semmilyen kategória-jelet
    // nem ad (labeledUse, categoryLine, breadcrumb, usageBars, prose: mind
    // néma), a két találat pedig MINDKETTŐ TÉVES:
    //   * `nameAndUrl` → touring, mert a modell neve „Explorer" — SEO-név,
    //     nem használat (ugyanaz a csapda, mint a FunWater „Island
    //     Explorer"-énél);
    //   * `multiUseProse` → fishing + touring, a „Whether you love yoga,
    //     fishing, fitness, or just floating in the sun" mondatból — az
    //     felsorolás, nem besorolás.
    // A rögzítés az egyetlen becsületes út.
    categoryMethods: ["pinnedUrl"],
    // A márka egyetlen modellnél sem közöl űrtartalmat.
    unpublishedFields: ["volumeL"],
  },
};
