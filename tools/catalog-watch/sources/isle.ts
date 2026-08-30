/**
 * ISLE (islesurfandsup.com) — amerikai gyártó, FEJETLEN (headless) bolttal
 * (F2.1-utó-55, 2026-08-29).
 *
 * Az eddigi legjobb adatú forrásunk: mind a HAT mező megvan minden deszkán,
 * űrtartalommal együtt — csak épp egyik sem ott van, ahol eddig kerestük.
 *
 *  * **A HTML egy React-váz.** A `/products.json` 404, a `htmlToText` a
 *    spec-ből SEMMIT nem lát: a teljes adat egy `<script>`-be ágyazott
 *    API-válaszban áll, CSV-alakban
 *    (`"sizes":{"value":"Length,Width,Thick,…\n10'6\",34\",6\",…"}`). Erre
 *    való az `embeddedSpecAnchor` (ld. `embedded.ts`).
 *
 *  * **A HORGONY NÉLKÜL ROSSZ DESZKÁT ADNA.** Ugyanazon a lapon több ilyen
 *    CSV áll — a termékajánlóké is. Az `explorer-pro-2` lapján HÁROM van, és
 *    az ELSŐ a szomszéd modellé (`explorer-pro`, 31,5" a 31" helyett). A
 *    `productBoxAccordionItems` kulcs oldalanként PONTOSAN egyszer fordul elő,
 *    és a termék saját adata 140 karakterrel utána áll.
 *
 *  * **A „kayak" szó a kollekció FELÉT kizárta.** Hat deszka — a Switch-család
 *    és a Pro-széria — SUP–kajak HIBRID: `Switch Paddle Board Kayak Hybrid`,
 *    `Explorer Pro Hybrid SUP-Kayak Inflatable Paddle Board`. Ezek deszkák,
 *    amikre ülés is tehető; a gyártó a „Stand Up Paddle Boards" kollekcióba
 *    sorolja őket, a spec-blokkjuk deszka-spec. A `NEVER_BOARD_KEYWORDS`
 *    viszont mind a hatot eldobta, hibátlan adat mellett. A kivétel szűk:
 *    a kajak-szó akkor nem kizáró, ha a termék KIMONDJA, hogy hibrid, ÉS
 *    deszkának is nevezi magát — a `flywater-micro-skiff-kayak` egyiket sem
 *    teszi, tehát változatlanul kiesik.
 *
 *  * **A modellnév a JSON-LD-ből** (`modelNameFromJsonLd`), mint a BOTE-nál:
 *    a `<title>` SEO-mondat („Explorer Pro Hybrid SUP-Kayak Inflatable Paddle
 *    Board | ISLE | ISLE Paddle Boards"), a JSON-LD `name` viszont a
 *    katalógusnév („Explorer Pro v1").
 *
 *  * **A gyártó SAJÁT mezői döntik el a kategóriát és a szerkezetet.** Az
 *    `Ideal For` (`All Around Paddling`, `Long Distance Paddling`) a
 *    `labeledUse` bemenete, a `Type` (`Inflatable` / `Hardboard` /
 *    `Inflatable Hardboard`) pedig a felfújhatóságé. Utóbbi azért kellett
 *    kimondottan: MINDEN termékoldal említi a kemény modelleket is, ezért a
 *    szöveg-alapú olvasás minden deszkára `null`-t adott volna.
 *    Az „Inflatable Hardboard" a gyártó konstrukció-neve a merevebb Pro
 *    szériára — az FELFÚJHATÓ; a `Versa 2.0` az egyetlen valóban kemény
 *    deszka (`Type: Hardboard`).
 *
 * AMIT A GYÁRTÓ HIBÁSAN KÖZÖL, és nem javítunk ki helyette:
 *  * **Sportsman**: `Length: 11.6"` — hüvelyk-jel láb helyett; ebből 29,5 cm
 *    „hossz" lesz egy 11'6"-os (350 cm) deszkára. A saját `switch-isup`
 *    lapján ugyanez a szám helyesen `11'6"`. A gyanú-jelzés emiatt kiveszi a
 *    tömeges jóváhagyásból — moderátori döntés, `verify-specs`-szel írható
 *    felül. Kitalálni nem szabad helyette.
 *
 * A SZÍNVÁLTOZAT-KÉRDÉS itt is előjön: a `?Model=…&Color=…` paraméterek
 * ugyanazt a deszkát adják más színben, ezért a lekérdező rész eldobandó
 * (`stripUrlQuery`).
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "ISLE",
  baseUrl: "https://islesurfandsup.com",
  kind: "brand_site",
  country: "US",
  crawlConfig: {
    notes:
      "FEJETLEN (headless) bolt: a /products.json 404, a spec-tábla egy <script>-be ágyazott API-válaszban áll CSV-alakban. Az embeddedSpecAnchor a termék SAJÁT blokkját jelöli — nélküle a lapon álló termékajánlók spec-je nyerne (az explorer-pro-2 lapján az ELSŐ CSV a szomszéd modellé). Mind a hat mező megvan, űrtartalommal. A Switch-család és a Pro-széria SUP–kajak HIBRID: deszka, ülés-opcióval. A Versa 2.0 az egyetlen KEMÉNY deszka (Type: Hardboard); az „Inflatable Hardboard” a gyártó konstrukció-neve, az felfújható. HIBÁS GYÁRTÓI ADAT: a Sportsman hossza 11.6\" (hüvelyk-jel láb helyett) — 29,5 cm helyett 350 cm a valós, moderátori javítás kell.",
    htmlOnly: true,
    modelNameFromJsonLd: true,
    embeddedSpecAnchor: "productBoxAccordionItems",
    sitemapUrl: "https://islesurfandsup.com/sitemap.xml",
    // A SUP-kollekció 16 terméke közül a `flywater-micro-skiff-kayak` csónak —
    // azt a besoroló ejti (nincs se „hybrid", se deszka-főnév a nevében).
    productUrlPatterns: [
      "-paddle-board",
      "-isup",
      "explorer-pro",
      "pioneer-pro",
      "versa-epoxy",
    ],
    // A `-package`/`bundle` szettek ugyanazt a deszkát adják tartozékokkal;
    // a `blade`/`backpack`/`mount` kiegészítők nevében is ott a „paddle board".
    excludeUrlPatterns: ["-bundle", "extra-blade", "backpack", "mount", "roof-rack"],
    // Ugyanaz a deszka más színben (`?Model=3+Series&Color=Coral%2FSun`) —
    // enélkül minden színváltozat külön jelölt lenne.
    stripUrlQuery: true,
    defaultBrandName: "ISLE",
    // MÉRVE (2026-08-29): a `labeledUse` a gyártó saját `Ideal For` mezőjéből
    // MINDEN deszkára ad besorolást, ezért az áll elöl. A `nameAndUrl` a
    // tartalék (a Sportsmannél a „fishing" a névből jön).
    categoryMethods: ["labeledUse", "nameAndUrl", "pinnedUrl"],
  },
};
