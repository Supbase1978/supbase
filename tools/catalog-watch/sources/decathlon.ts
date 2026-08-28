/**
 * DECATHLON (decathlon.hu) — az ITIWIT/Decathlon saját márkás SUP-jai
 *
 * A MÁRKANÉV MEGVÁLTOZOTT: a piaci táblázatunk „Itiwit"-et ír, a bolt viszont
 * ma mindenütt `DECATHLON` márkanevet tesz ki (JSON-LD `brand`, terméklista,
 * termékfejléc). Az Itiwit a korábbi sportmárka-név ugyanezekre a deszkákra —
 * ezért a forrás neve Decathlon, és a `defaultBrandName` is az.
 *
 *  * NINCS TERMÉK-SITEMAP. A `robots.txt` KÉT sitemapot hirdet; a működő
 *    (`/sitemap-index.xml`) öt gyerek-sitemapot sorol (brands,
 *    category-product-listing, filtered-pages, content-pages,
 *    sports-activities) — MIND az 8665 URL-ből NULLA a `/p/` termékoldal.
 *    A felderítés ezért kategória-oldalról megy (`productListUrls`).
 *  * CLOUDFLARE ROBOT-ELLENŐRZÉS MINDEN HTML-OLDALON. Sima HTTP-letöltés:
 *    `403` + „Just a moment…". FEJ NÉLKÜLI Chrome-mal sem oldódik meg (30 s
 *    alatt sem jutott át, se a csomagolt chromiummal, se a rendszer
 *    Chrome-jával); FEJES Chrome-mal 2 másodperc alatt átmegy, és a további
 *    oldalak már ellenőrzés nélkül jönnek. Innen a `browserFetch: true`.
 *    A `robots.txt` és a sitemapok viszont normálisan kiszolgálódnak — tehát
 *    ez robot-védelem, nem tiltás, és a robots.txt-t ugyanúgy betartjuk.
 *    ÁRA: a havi CI-futásban ez a forrás nem fog átmenni (a runner fej
 *    nélküli). A bejárás LOKÁLIS, kézi menet; a beírt adatot a `verify-specs`
 *    zárolja, tehát egyszeri gyűjtés után marad.
 *  * A `/hu/ajax/nfs/…` JSON-végpontok (amikből az oldal épül) NEM járhatók:
 *    a `robots.txt` kifejezetten tiltja a `/hu/ajax/`-ot.
 *  * MARKETPLACE KIZÁRVA: a `/p/mp/<eladó>/…` URL-ek harmadik felek termékei
 *    (Aqua Marina, Thunder, F2, Skiffo…), nem a Decathlon sajátjai. Ezeket a
 *    saját gyártói forrásaikból gyűjtjük, itt csak duplikátumot adnának.
 *
 * A LEÍRÁS-BLOKK CSAPDÁI (mind élesben mérve, 2026-08-28):
 *  * MINDEN MÉRET KÉT ÍRÁSMÓDDAL, az imperiálissal elöl:
 *    `Hosszúság: 14' (426 cm)`, `Szélesség: 33" (84 cm)`. A gyártó saját
 *    zárójeles átváltása nyer (ld. `parseDimensionCm`) — enélkül a
 *    `Vastagság: 4'75" (12 cm)` alakból 4 láb + 75 hüvelyk = 312 cm „vastagság"
 *    lett, és a `Szélesség` ablaka a KÖVETKEZŐ sor láb-értékét szedte fel.
 *  * A DESZKA UTÁN A TÁSKA ADATAI JÖNNEK, ugyanazokkal a címkékkel
 *    (`Táska az összehajtott SUP-pal:` / `Tok…` / `Összehajtva:` alatt
 *    `Magasság`, `Szélesség`, `Vastagság`, `Súly: 500 g`). A deszka blokkja
 *    mindig ELŐBB áll, és a címke-kereső az ELSŐ találatot veszi — ezen múlik,
 *    hogy nem a táska mérete kerül be.
 *  * SÚLY: ugyanabban a blokkban négy tömeg áll egymás alatt —
 *    `Súly (csak a deszka): 8,4 kg`, `Deszka + szkeg + leash + hátizsák
 *    együtt: 9,6 kg`, `Az evező súlya: 1,2 kg`, `A pumpa súlya: 1200 g`. A
 *    lap alján a technikai mező a TELJES SZETT tömegét ismétli (`Súly / 13,5
 *    kg`). Kezelve: a `súly (csak a deszka)` a legspecifikusabb címke, az
 *    `evező`/`pumpa` pedig kizáró előtag.
 *  * TEHERBÍRÁS — A LEGFONTOSABB: a gyártó „Maximális terhelhetőség" sora NEM
 *    teherbírás, hanem ARKHIMÉDÉSZ. Pontosan annyi kg, ahány liter a deszka
 *    térfogata (350 l → 350 kg, 335 l → 335 kg, 245 l → 245 kg), és a gyártó
 *    ki is mondja: „Max. terhelhetőség, AMÍG A VÍZFELSZÍNEN MARAD". A valós
 *    korlát az ajánlott evezős-súly („Max. 140 kg-ig ideális"), ez kerül be —
 *    ugyanaz a döntés, mint a Jobe „Recommended rider weight"-jénél.
 *  * A MODELLNÉVBEN A MÉRET AZ EGYETLEN MEGKÜLÖNBÖZTETŐ JEGY: a „SUP szett,
 *    9'6 … - 100-as" és a „SUP szett, felfújható, 10'6 - 100-as" a méret
 *    nélkül egyaránt „100" lenne. Innen a `titleKeepSize`.
 *  * `titleNoiseWords`: a magyar `-as`/`-es` sorszám-rag a kötőjel levágása
 *    után árva szóként marad („500 as"); az „egy személynek" pedig leírás,
 *    nem modellnév.
 *
 * KATEGÓRIA — MIÉRT KÉZI (`boardTypeByUrl`): a morzsamenü MIND A HAT deszkán
 * ugyanazt mondja (`… › SUP felhasználási mód szerint › Túra SUP`), tehát a
 * bolt egyetlen levélbe sorolta az egész kínálatát — a 9'6-os, 80 kg-ig
 * ajánlott kezdő szettet is. Ez nem besorolás, hanem menü-elhelyezés. A
 * gyártó SAJÁT leírása viszont egyértelmű: az Explo 900 és a 12'6 500-as
 * „ideális túrázáshoz" / „egynapos kiránduláshoz", a többi „kezdőknek",
 * „nyugodt vízen", „családi utazásokhoz" — allround.
 *
 * A GYÁRTÓ SAJÁT ADATHIBÁJA (nem a kinyerésé): a „SUP, kompakt - 100-as"
 * lapján `Vastagság: 14' (35,5 cm)` áll (a 14 HÜVELYKET váltották át lábként;
 * a deszka 15 cm vastag), és az űrtartalom sora `Szélesség: 325 liter.`
 * címkével — emiatt a térfogat üresen marad. Moderációnál mindkettőt kézzel
 * kell javítani (`verify-specs`).
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Decathlon",
  baseUrl: "https://www.decathlon.hu",
  // `shop`, nem `brand_site`: a decathlon.hu bolt — csak épp a SAJÁT márkáját
  // gyűjtjük róla, ezért az adat gyártói minőségű.
  kind: "shop",
  country: "HU",
  crawlConfig: {
    notes:
      "A Decathlon (korábban Itiwit) saját márkás SUP-jai. NINCS termék-sitemap (a hirdetett " +
      "sitemap-index egyetlen /p/ URL-t sem tartalmaz), ezért kategória-oldalról derítünk fel. " +
      "MINDEN HTML-oldal Cloudflare robot-ellenőrzés mögött van: sima HTTP és fej nélküli " +
      "böngésző is 403-at kap, fejes Chrome átmegy — innen a browserFetch. Emiatt a havi " +
      "CI-futásban ez a forrás NEM megy át, a bejárása lokális, kézi menet. A teherbírás az " +
      "AJÁNLOTT EVEZŐS-SÚLY: a gyártó „maximális terhelhetőség\" sora a térfogattal azonos " +
      "arkhimédészi merülési határ, nem terhelési adat.",
    htmlOnly: true,
    browserFetch: true,
    minDelayMs: 2000,
    productListUrls: [
      // A DECATHLON SAJÁT MÁRKÁJÁRA szűrt lista (`f-brand_decathlon`): a
      // szűrő nélküli kategóriában a marketplace-eladók termékei is
      // megjelennek. A hat saját deszka mind itt van; a teljes
      // `stand-up-paddle-sup-deszka` kategória ezen felül csak wingfoil
      // deszkákat adna, azok nem SUP-ok.
      "https://www.decathlon.hu/sportok/stand-up-paddle-sup/felfujhato-sup-deszka/f-brand_decathlon",
    ],
    // A kártyák háromféle alakban hivatkoznak ugyanarra a deszkára — a
    // színválasztó paraméter ugyanaz a termék.
    stripUrlQuery: true,
    productUrlPatterns: ["/p/"],
    excludeUrlPatterns: [
      // Harmadik felek termékei (ld. fent).
      "/p/mp/",
      // A listaoldalon mindig ott a lábléc ajándékkártyája.
      "ajandekkartya",
    ],
    defaultBrandName: "Decathlon",
    titleSuffixes: [" - Decathlon"],
    titleKeepSize: true,
    titleNoiseWords: ["as", "es", "egy személynek"],
    boardTypeByUrl: {
      // Túra: a gyártó szerint „ideális túrázáshoz" (14', 426 cm) …
      "R-p-365164": "touring",
      // … illetve „ideális egynapos kiránduláshoz" (12'6, 381 cm).
      "R-p-347569": "touring",
      // Allround: kezdő/családi szettek, nyugodt vízre — a morzsamenü ezeket
      // is „Túra SUP"-nak mondja, a leírásuk viszont nem.
      "R-p-365154": "allround",
      "R-p-356321": "allround",
      "R-p-352133": "allround",
      "R-p-332301": "allround",
    },
  },
};
