/**
 * UONE (u1.net.pl) — lengyel gyártó, saját webshoppal.
 *
 * A LEGJOBBAN SZERKESZTETT SPEC-TÁBLA, amivel eddig dolgoztunk: a „Parametry"
 * fül mind a hat mezőnket kiadja, címkézve és a NYERS HTML-ben (nem kell
 * renderelés) — `Długość deski`, `Szerokość`, `Wysokość`, `Pojemność`, `Waga`,
 * `Rekomendowane/ maksymalne obciążenie`, plusz a `Typ deski` besorolás.
 *
 *  * A MÉRETEK KETTŐS ÍRÁSMÓDDAL állnak (`12’6″ / 381 cm`), és a rövid,
 *    fejléc alatti összefoglalóban a gyártó LÁB-JELET ír HÜVELYK helyett
 *    (`Szerokość: 32’/81cm`). Nem okoz bajt: ahol van centiméter, ott a
 *    metrikus érték nyer — ez a szabály az Indiana óta él.
 *  * `Wysokość` = a deszka VASTAGSÁGA. A lengyel „grubość" (szó szerint
 *    vastagság) ezen a lapon az ANYAGÉ, milliméterben (`Grubość burty:
 *    0.75mm`) — abból 0,08 cm-es deszka lenne, ezért az a szó SZÁNDÉKOSAN
 *    nincs a címkéink között.
 *  * TEHERBÍRÁS: `150kg/ 300kg` egyetlen mezőben. Az AJÁNLOTT áll elöl, és az
 *    kerül be — a 300 kg a 350 literes térfogathoz tartozó merülési határ,
 *    ugyanaz az arkhimédészi csapda, mint a decathlon.hu-n.
 *
 * ÉLESBEN MÉRT CSAPDA — A SZŰRŐ-OLDALSÁV: a termékoldalon ott a kategória
 * szűrő-panelje, ugyanazokkal a CÍMKÉKKEL, mint a spec-tábla, és felsorolja az
 * ÖSSZES lehetséges értéket (`Typ deski` ⏎ `Deski SUP – Allround` ⏎
 * `… – Gigant` ⏎ `… – Race`…), ráadásul ELŐBB, mint a termék saját adata.
 * Emiatt minden deszka „allround" lett a valódi `Typ deski: Touring` helyett,
 * és a `Waga użytkownika` szűrőből 100 kg került a deszka tömegébe. A
 * `labelledUseText` ezért mostantól kétmenetes: a KETTŐSPONTOS alak
 * (`Typ deski: Touring`) megy előbb, azt csak a spec írja, a szűrő nem.
 *
 * A DESZKA SÚLYÁT NEM VESSZÜK ÁT, pedig a tábla közli (`Waga: 10.5 kg`):
 * ugyanezen a lapon KÉT `Waga` sor van, az első a kiszállított SZETT tömege
 * (15 kg), a második a deszkáé — szövegben megkülönböztethetetlenül. Inkább
 * maradjon üresen, mint hogy a csomag tömege kerüljön a deszka mezőjébe. Ez
 * nem „a gyártó nem közli" eset, ezért NEM `unpublishedFields`.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Uone",
  baseUrl: "https://www.u1.net.pl",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
    notes:
      "Lengyel gyártó saját boltja. A „Parametry\" tábla a nyers HTML-ben van, és mind a hat " +
      "mezőt kiadja. A `Wysokość` a deszka vastagsága (a „grubość\" az ANYAGÉ, mm-ben). A " +
      "teherbírás mezője két számot ad (`150kg/ 300kg`), az AJÁNLOTT áll elöl és az kerül be — " +
      "a maximum a térfogathoz tartozó merülési határ. A DESZKA SÚLYÁT szándékosan nem vesszük " +
      "át: két `Waga` sor van, az első a szett tömege. A termékoldal szűrő-oldalsávja " +
      "ugyanazokat a címkéket viseli, mint a spec — ezért kell a kettőspontos alak elsőbbsége.",
    htmlOnly: true,
    minDelayMs: 1500,
    sitemapUrl: "https://www.u1.net.pl/product-sitemap.xml",
    productUrlPatterns: ["/deska-sup-"],
    excludeUrlPatterns: [
      // HASZNÁLT deszkák — nem katalógus-tételek.
      "uzywana",
      // UGYANAZ a deszka, kisebb csomagban — külön jelöltként duplikátum lenne.
      "bez-akcesoriow",
      "bez-drybag",
      // Kölcsönzőknek szánt gyűjtő-tétel, nem egy modell.
      "do-wypozyczalni",
      // A boltban viszonteladott MÁS márkák (használt Shark, Tribord, Tsunami)
      // — azokat a saját gyártójuktól gyűjtjük, ha egyáltalán.
      "shark",
      "tribord",
      "tsunami",
    ],
    defaultBrandName: "Uone",
    titleSuffixes: [" | Sklep Uone"],
    // A cím szerkezete `<modell> | <reklámszöveg> | Sklep Uone` — a bolt-utótag
    // levágása után a MARADÉK első darabja a modell, a többi reklám
    // („| Zawór bezpieczeństwa", „| Pompowany SUP z żaglem", „| Różowy Stand
    // Up Paddle"). Itt az elülső darab NEM a márkanév, tehát az marad.
    titleCutAfter: ["|"],
    // A méret az egyetlen megkülönböztető jegy a színváltozatok között: a
    // „Super" sorozat 10'6\", 11'6\" és 12'6\" méretben is fut, és a név
    // egyébként csak a színben térne el („Super PURPLE" kontra „Super BLUE").
    titleKeepSize: true,
    // A „zestaw"/„premium" csomag-jelölés, a „do" pedig a levágott teherbírás
    // („… do 320 kg") után marad árván a név végén.
    titleNoiseWords: ["deska", "uone", "sklep", "zestaw", "premium", "do"],
    categoryMethods: ["labeledUse"],
  },
};
