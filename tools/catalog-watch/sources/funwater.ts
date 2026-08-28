/**
 * FUNWATER (funwaterboard.com) — D2C Shopify-bolt, HÁROM saját márkával
 *
 * Itthon sokan használják (Amazon/eMAG), ezért a katalógusban a helye
 * indokolt, még ha a forrás minősége el is marad a nyugat-európai gyártókétól.
 *
 * MIÉRT NEM SHOPIFY-MÓD, pedig Shopify: a `/products.json` itt CSAK
 * marketingszöveget ad `body_html`-ben — se méret, se teherbírás, se súly. A
 * variánsok ráadásul `Default Title`-ök (nem méretek), tehát a Starboardnál
 * bevált méretenkénti bontás sem alkalmazható: itt EGY termék EGY méret. A
 * teljes spec a TERMÉKOLDAL nyers HTML-jében van — renderelés nélkül.
 *
 *  * KÉT SABLON él egymás mellett:
 *    1. GemPages-rács — a címke és az érték külön sorban:
 *       `Capacity` / `350LBS` / `Weight` / `12.74KG` / `Versatility` / `…`
 *    2. kettőspontos „Specs" blokk:
 *       `Dimensions: 9 ′6″ L × 30″ W × 4″ D` / `Capacity： 300 Pounds` /
 *       `Item Weight: 28 Pounds` / `Package Weight: 18.87 Kilograms`
 *  * A második sablonban TELJES SZÉLESSÉGŰ kettőspont (`：` U+FF1A) és
 *    LÁTHATATLAN irányjel (U+200E) áll az érték előtt — mindkettő kínai
 *    eredetű sablon-örökség, és mindkettő megvakította a mintáinkat.
 *  * A `Package Weight`/`Package Dimensions` a SZÁLLÍTÁSI DOBOZÉ, nem a
 *    deszkáé — kizárva (`PACKAGE_QUALIFIERS`).
 *  * A KATEGÓRIÁT a gyártó KIMONDJA (`Versatility: All-around, ideal for
 *    cruising, exploring, and yoga`), ezért `labeledUse` a fő módszer. A
 *    névből tippelés itt kifejezetten TÉVED: az „Island Explorer" all-round
 *    deszka, nem túra; a „Monkey Touring" is all-round.
 *  * ŰRTARTALMAT EGYETLEN MODELLNÉL SEM KÖZÖL (2026-08-28, hét terméklapon
 *    ellenőrizve; a „volume" találatok az „annual sales volume"
 *    marketingsorból jönnek). Ezért `unpublishedFields`.
 *  * A CÍMEK marketing-szóhalmazok, és a `|` jel KÉTFÉLE szerepben áll:
 *    márkanév-előtagként és reklám-utótag előtt is. A `titleCutAfter` ezt
 *    megkülönbözteti (ld. `extractProductFromPage`), de a modellnevek így is
 *    moderátori csiszolást kívánnak — a forrás nem ad tiszta modellnevet.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "FunWater",
  baseUrl: "https://www.funwaterboard.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
    // MÉRVE (2026-08-28, hét terméklapon): a `labeledUse` a gyártó SAJÁT
    // állítása, ezért ez a fő módszer. A `nameAndUrl` marad utána, mert a
    // második sablonon (nincs `Versatility` mező) az az egyetlen jel — a
    // `multiUseProse` viszont KIMARAD: ennek a forrásnak a prózája
    // reklámszöveg, tele „cruising/exploring/yoga" szavakkal minden deszkán.
    categoryMethods: ["pinnedUrl", "labeledUse", "nameAndUrl"],
    notes:
      "D2C Shopify-bolt három saját márkával (Funwater, Feath-R-Lite, Tuxedo Sailor). " +
      "A /products.json NEM ad specifikációt, csak marketingszöveget — a spec a termékoldal " +
      "nyers HTML-jében van, két különböző sablonban. ŰRTARTALMAT NEM KÖZÖL (2026-08-28, " +
      "terméklapokon ellenőrizve). A modellnevek marketing-címekből jönnek, moderátori csiszolást kívánnak.",
    unpublishedFields: ["volumeL"],
    htmlOnly: true,
    minDelayMs: 1500,
    // A SITEMAP-INDEXRE mutatunk, nem a termék-sitemapre: a Shopify a
    // `sitemap_products_1.xml`-t CSAK aláírás-paraméterrel szolgálja ki
    // (`?from=…&to=…`), közvetlenül hívva 400-at ad. A paraméterek a
    // termék-ID-tartományt kódolják, tehát új terméknél elavulnak — az
    // indexből viszont mindig a friss alak jön.
    sitemapUrl: "https://www.funwaterboard.com/sitemap.xml",
    titleCutAfter: ["|"],
    // MÉRVE (2026-08-28, 25 terméklapon): a címek SEO-halmazok, nem
    // modellnevek — „Cheap Polar Bear 10′6″ Touring", „Best Paddle Boards
    // Smiling Face Touring", „Stand Up For Sale Arrow 12′7″ Racing". Ami
    // marad utánuk, az a VALÓDI modellnév (Polar Bear, Smiling Face, Arrow).
    //
    // A „touring" is ITT van, és ez a legkényesebb tétel: a forrás MINDEN
    // termékének a címébe beleírja kulcsszóként, függetlenül attól, milyen
    // deszka — a besorolást a gyártó külön mezőben (`Versatility`) mondja ki,
    // amit a `labeledUse` olvas. Máshol (Indiana 12'6 Touring) ez valódi
    // modellnév-rész lenne, ezért forrás-szintű a lista.
    titleNoiseWords: [
      "stand up paddle boarding",
      "paddle boarding",
      "paddle boards",
      "hot-selling",
      "hot selling",
      "for sale",
      "most durable",
      "lightweight",
      "stand up",
      "cheap",
      "best",
      "top",
      "sale",
      "new",
      "touring",
      "racing",
      "surfing",
    ],
    defaultBrandName: "Funwater",
    productUrlPatterns: ["/products/"],
    excludeUrlPatterns: [
      // A bolt katalógusának kétharmada NEM deszka (ruházat, cipő, hűtőtáska,
      // kajak, kiegészítők). Az URL-minta itt nem szűr, mert minden termék
      // `/products/` alatt van — a `classifyProduct` kapuja dönt.
      "/collections/",
      "/blogs/",
      "/pages/",
    ],
  },
};
