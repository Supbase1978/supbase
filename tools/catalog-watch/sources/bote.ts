/**
 * BOTE (boteboard.com) — amerikai gyártó, Shopify-bolton (F2.1-utó, 2026-08-29).
 *
 * Amit a bekötés megtanított:
 *
 *  * **A Shopify NEM ok a Shopify-módra** — sokadszor. A `/products.json`
 *    kiszolgál, de a `body_html` csak marketingszöveg, a variánsok pedig
 *    SZÍN+MÉRET párok spec nélkül: se méret cm-ben, se teherbírás, se súly.
 *    A teljes „Technical Specs" blokk a termékoldal NYERS HTML-jében van,
 *    tehát a helyes út a `htmlOnly`.
 *
 *  * **A modellnév a JSON-LD-ből jön, nem a `<title>`-ből** (`modelNameFromJsonLd`).
 *    A címek termékenként MÁS SEO-sablont követnek, és kettő egyenesen kárt
 *    okozott:
 *      - `Beginner Inflatable Paddle Board — SUP & Kayak | BOTE` — az
 *        EasyRider Aero címe a modellnevet KI SEM MONDJA;
 *      - `LowRider Aero Tandem Duo Paddle Board | SUP Kayak Hybrid | BOTE` —
 *        a „Kayak" szótól a `classifyProduct` KAJAKNAK nézte és eldobta.
 *    Mindkét deszka NULLA jelöltet adott. A `Product` JSON-LD `name`-je
 *    ugyanezeken az oldalakon pontosan a katalógusnév („EasyRider Aero",
 *    „LowRider Aero Tandem") — mind a 9 modellnél.
 *
 *  * **EGY oldal KÉT deszkát ír le**, méretenként MEGISMÉTELT címkézett
 *    blokkal (`10′4″ Specs` … `11′4″ Specs`). A WULF Aero és a Breeze Aero
 *    két-két mérete külön deszka, más teherbírással (250 kontra 315 LBS) —
 *    a szokásos, első-találat-nyer olvasás a nagyobbat elveszítette. Ezt a
 *    `parseLabeledSpecsBySize` bontja szét, a méretjelöléssel a modellnévben.
 *    A méret-fejléc alakja UGYANAZON A BOLTON belül kétféle: a WULF-nál
 *    tipográfiai (`10′4″`), a Breeze-nél egyenes jel (`10'6"`).
 *
 *  * **A gyártó ÁTLAGSÚLYT közöl** (`Avg. Weight: 20 LBS`) — új címke. A
 *    lapon ott áll mellette a `Loaded Bag Weight` (a becsomagolt szett) és a
 *    `Seat Weight` (a tartozék ülés); egyikbe sem illik bele az „avg", ezért
 *    a szűk címke elhatárol. A `Travel Bag Dimensions` ugyanígy a deszka
 *    méretei UTÁN áll, tehát az első-találat-nyer szabály védi ki.
 *
 *  * **Minden érték imperiális** (LBS, láb-hüvelyk) — a `×` szorzójel U+00D7,
 *    a láb/hüvelyk jel pedig hol tipográfiai, hol egyenes, egy lapon KEVERTEN
 *    is (ProRider: `12'6" L × 38″ W × 7″ D`).
 *
 *  * **A csomagok külön termékek.** A 13 „Inflatable Paddle Boards" tételből
 *    4 a `…-package` alak: ugyanaz a deszka evezővel és pumpával. Az URL-minta
 *    ezért STRUKTURÁLIS szűrő, a `-package` pedig kizáró — nem heurisztika.
 *
 *  * **A kategória a gyártó SAJÁT `activity:` címkéiből** (`boardTypeByUrl`).
 *    A címkék a `/products.json`-ben állnak, a termékoldal HTML-jében nem,
 *    ezért a taxonómiát EGYSZER olvastuk ki, és a receptbe került — ugyanaz
 *    az elv, mint a Gladiatornál és a Zraynél. A leképezés:
 *      `All Purpose` / `Recreation` / `Leisure` → allround,
 *      `Expedition` → touring, `Fishing` → fishing,
 *      `Family Fun` → önmagában semmit nem mond a HASZNÁLATRÓL, ezért nem
 *      képezzük le.
 *    Ahol a gyártó többet is megad, a FŐ felhasználás nyer (HD Aero: hat
 *    címke, de a platform maga all-round; Rackham Aero: `Fishing` +
 *    `Expedition`, a saját címe is „Inflatable Fishing SUP").
 *
 *  * **Űrtartalmat a márka EGYETLEN modellnél sem közöl** (2026-08-29,
 *    mind a 9 termékoldalon ellenőrizve) — méretet, súlyt és teherbírást igen.
 *
 * AMI KIMARADT, és miért: a `…-gatorshell-…` KEMÉNY deszkák (Breeze, HD,
 * Rackham) ugyanezen a bolton élnek, de a felhasználó kérése a felfújható
 * kollekcióra szólt. Az URL-mintájuk kész van (`-gatorshell-`), a bekötésük
 * egy sor — külön döntés kérdése.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "BOTE",
  baseUrl: "https://www.boteboard.com",
  kind: "brand_site",
  country: "US",
  crawlConfig: {
    notes:
      "Shopify-bolt, de a /products.json SPEC NÉLKÜLI (csak marketing-próza és szín-variánsok) — a teljes Technical Specs a nyers HTML-ben van, ezért htmlOnly. A modellnév a Product JSON-LD-ből: a <title> termékenként más SEO-sablon, az EasyRider Aeroé ki sem mondja a nevet, a LowRider Aero Tandemé pedig a „Kayak” szótól kajaknak minősült. A WULF és a Breeze EGY oldalon KÉT méretet ad, méretenként megismételt címkézett blokkban. Minden érték imperiális (LBS, láb-hüvelyk). ŰRTARTALMAT NEM KÖZÖL (2026-08-29, mind a 9 termékoldalon ellenőrizve).",
    htmlOnly: true,
    modelNameFromJsonLd: true,
    sitemapUrl:
      "https://www.boteboard.com/sitemap_products_1.xml?from=2432269287542&to=8413214277771",
    // STRUKTURÁLIS szűrő: a felfújható deszkák kivétel nélkül `-aero-`
    // előtaggal élnek, a kemény deszkák `-gatorshell-`-lel, a kajakok és a
    // kiegészítők pedig nem viselik a `paddle-board` szegmenst.
    //
    // A MINTA RÉSZSTRING, ezért a `hybrid` ág NEM viheti magával az `-aero-`
    // előtagot: a `lowrider-aero-TANDEM-hybrid-paddle-board`-ba beékelődik a
    // változat neve, és az `-aero-hybrid-paddle-board` minta épp azt a
    // deszkát hagyta ki (élesben mérve: 8 URL a 9 helyett).
    productUrlPatterns: ["-aero-inflatable-paddle-board", "hybrid-paddle-board"],
    // A CSOMAG ugyanaz a deszka evezővel és pumpával — a katalógusban
    // duplikátum lenne. A `-tailgate-pad` a platón használt alátét.
    excludeUrlPatterns: ["-package", "tailgate-pad"],
    defaultBrandName: "BOTE",
    // A gyártó SAJÁT `activity:` címkéi (ld. a fejlécet). A `Family Fun` nem
    // szerepel: az a célközönség, nem a használat.
    //
    // A KULCS TELJES ÚTVONAL, nem puszta slug — a `boardTypeByUrl` RÉSZSTRINGET
    // illeszt, és a `kids-fLOWRIDER-AERO-HYBRID-PADDLE-BOARD` tartalmazza a
    // `lowrider-aero-hybrid-paddle-board` kulcsot. Élesben mérve a gyerekdeszka
    // így `allround` lett `kids` helyett; a `/products/` előtag zárja ki.
    boardTypeByUrl: {
      "/products/wulf-aero-inflatable-paddle-board": "allround",
      "/products/breeze-aero-inflatable-paddle-board": "allround",
      "/products/hd-aero-inflatable-paddle-board": "allround",
      "/products/rackham-aero-inflatable-paddle-board": "fishing",
      "/products/easyrider-aero-hybrid-paddle-board": "allround",
      "/products/lowrider-aero-hybrid-paddle-board": "allround",
      "/products/lowrider-aero-tandem-hybrid-paddle-board": "allround",
      "/products/prorider-aero-hybrid-paddle-board": "allround",
      "/products/kids-flowrider-aero-hybrid-paddle-board": "kids",
    },
    // MÉRVE (2026-08-29, probe-methods): itt CSAK a `pinnedUrl` és a
    // `nameAndUrl` ad megbízható találatot. A `multiUseProse` SZÁNDÉKOSAN
    // marad ki: ezen a bolton a VÁSÁRLÓI ÉRTÉKELÉSEK címére ugrott rá
    // („Ultimate Fishing and Exploration Inflatable SUP" — Donovan S). A
    // Rackhamnél történetesen jót adott (fishing + touring), de az vélemény,
    // nem gyártói állítás — és a következő értékelés bármit mondhat.
    categoryMethods: ["pinnedUrl", "nameAndUrl"],
    // A márka egyetlen modellnél sem közöl űrtartalmat.
    unpublishedFields: ["volumeL"],
  },
};
