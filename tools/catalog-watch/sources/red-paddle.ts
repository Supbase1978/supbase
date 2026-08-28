/**
 * RED PADDLE CO (red.equipment) — prémium gyártó, dedikált hazai importőrrel
 *
 * A DOMAIN A LÉNYEG: a `redpaddleco.com` a RÉGI WordPress-oldal, aminek
 * minden válaszát PHP-figyelmeztetések vezetik be (`Deprecated: Creation of
 * dynamic property Red_Item::$match…`), és a sitemap-indexében nincs is
 * termék-bejegyzés — csak `post`, `page`, `location`, `category`. Az élő bolt
 * a `red.equipment` (Shopify), és ott minden megvan.
 *
 *  * A `/products.json` itt is csak marketingszöveget ad — a spec a termékoldal
 *    NYERS HTML-jében van, renderelés nélkül. 19 deszka, kis katalógus.
 *  * A VARIÁNSOK EVEZŐ-VÁLASZTÁSOK (`No paddle`, `2025 Prime Paddle`), NEM
 *    méretek: egy termék = egy deszkaméret. A Starboardnál bevált méretenkénti
 *    bontás tehát itt nem alkalmazandó.
 *  * HOSSZAT A GYÁRTÓ EGYETLEN MEZŐBEN SEM KÖZÖL — a modellnév ELEJE a méret
 *    (`10'8" Ride MSL Inflatable Paddle Board Package.`). Ezért `lengthFromTitle`;
 *    enélkül a forrás EGYETLEN terméket sem adna (a hiányzó hossz kizár).
 *  * TEHERBÍRÁS-MEZŐ SINCS, a leírás viszont kimondja: „…for riders up to
 *    100kg". Ugyanaz a fajta korlát, mint a Jobe „Recommended rider weight"-je.
 *  * A KATEGÓRIÁT a gyártó CÍMKÉZETT mezőben adja (`Rider Style: All Round`) —
 *    `labeledUse`. A modellnévből tippelés itt téveszt: a „Voyager" és a
 *    „Compact" nem használati kategória.
 *  * ŰRTARTALMAT MODELLENKÉNT VÁLTOZÓAN közöl, és PRÓZÁBAN: „…at 27\" wide with
 *    150L of volume…", „295L of volume", „952L capacity". Ahol nem mondja ki,
 *    ott tényleg nincs — ezért NEM `unpublishedFields` (az a forrás EGÉSZÉRE
 *    szóló állítás lenne, és itt nem igaz).
 *  * ÖSSZEHASONLÍTÓ WIDGET a terméklapon: a SZOMSZÉD deszka spec-blokkja is
 *    ott áll, ugyanazokkal a címkékkel (`Width: 34"` és alatta `Width: 32"`).
 *    A megtekintett termék blokkja áll ELÖL (a `Viewing` jelölés után), és a
 *    címke-kereső az ELSŐ találatot veszi — így a helyes oszlop nyer. Ha a
 *    bolt egyszer megcseréli a sorrendet, ez a fixtúrán bukni fog.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Red Paddle Co",
  baseUrl: "https://red.equipment",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
    // MÉRVE: a `labeledUse` a gyártó SAJÁT `Rider Style` mezője. A
    // `multiUseProse` KIMARAD: ennek a márkának a prózája díjnyertes-
    // marketing, tele „touring/race/all-round" szavakkal minden deszkán.
    categoryMethods: ["pinnedUrl", "labeledUse", "nameAndUrl"],
    notes:
      "Shopify (red.equipment, NEM a régi redpaddleco.com). A /products.json nem ad " +
      "specifikációt; a spec a termékoldal nyers HTML-jében. HOSSZAT nem közöl mezőben " +
      "(a cím eleje a méret), TEHERBÍRÁST sem (a leírásban: riders up to …kg). " +
      "A terméklapon összehasonlító widget áll, benne a szomszéd deszka adataival.",
    htmlOnly: true,
    lengthFromTitle: true,
    // A `<title>` oldal-szintű utótagot visel: `… – Red Equipment - ROW`.
    // A gondolatjel a vágópont; a márkanév-előtagot a `cleanModelName` veszi ki.
    titleCutAfter: ["–"],
    // A globális zajlista a „stand up paddle" hármast ismeri, a bolt címeiben
    // viszont „Stand Up Paddle Board" áll — a „board" levágása után magára
    // marad a „Stand Up". A `package`/`bundle` a csomagajánlat jelölése, nem
    // modellnév.
    titleNoiseWords: ["stand up", "package", "bundle"],
    minDelayMs: 1500,
    sitemapUrl: "https://red.equipment/sitemap.xml",
    defaultBrandName: "Red Paddle Co",
    productUrlPatterns: ["/products/"],
    excludeUrlPatterns: ["/collections/", "/blogs/", "/pages/"],
  },
};
