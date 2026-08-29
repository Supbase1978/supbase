/**
 * catalog-watch — normalizálás: nyers JSON-LD/szöveg → `ExtractedProduct`
 * (terv 3. pont, „Normalizálás" bekezdés).
 *
 * TISZTA modul. Vezérelv: **inkább hiányozzon, mint tévedjen** — amit nem
 * tudunk biztosan kiolvasni, az `null` marad, és a moderátor tölti ki. Egy
 * rossz térfogat- vagy teherbírás-érték a Deszkaválasztóban BIZTONSÁGI hibává
 * válna (a terhelhetőség kemény szűrő), ezért a spec-parse konzervatív:
 * címkézett érték kell hozzá, „valahol a szövegben egy szám" nem elég.
 */
import type { GearCategory } from "../../src/modules/catalog/gear.ts";
import { decodeEntities, htmlToText } from "./html.ts";
import { buildCategoryMethods } from "./methods/catalog.ts";
import type { CategoryMethod, MethodContext } from "./methods/index.ts";
import { displayImageUrl, MAX_GALLERY_CANDIDATES } from "./images.ts";
import { findProductNodes, pickPrimaryProduct } from "./jsonld.ts";
import {
  boardTypeFromDescription,
  boardTypeFromUsage,
  findModelCode,
  findProductImage,
} from "./usage-rating.ts";
import type { BoardSpecs, BoardType, ExtractedProduct } from "./types.ts";
import { EMPTY_SPECS } from "./types.ts";

/**
 * Márka-alias-lista: bolti írásmód → kanonikus márkanév. Bővíthető; ami nincs
 * benne, az a bolt írásmódjával megy tovább (a moderátor javíthatja).
 */
export const BRAND_ALIASES: Record<string, string> = {
  "red paddle": "Red Paddle Co",
  "red paddle co": "Red Paddle Co",
  redpaddle: "Red Paddle Co",
  "starboard sup": "Starboard",
  starboard: "Starboard",
  "fanatic sup": "Fanatic",
  fanatic: "Fanatic",
  "aqua marina": "Aqua Marina",
  aquamarina: "Aqua Marina",
  "jobe sports": "Jobe",
  jobe: "Jobe",
  "f-one": "F-One",
  "f one": "F-One",
  gladiator: "Gladiator",
  spinera: "Spinera",
  "bluefin sup": "Bluefin",
  bluefin: "Bluefin",
  // Élesben mért eset (2026-07-31): a bluefinsupboards.eu JSON-LD-je a
  // termékek nagy részén "Bluefin-testing" márkanevet ad (a bolt oldalán
  // maradt teszt-adat) — enélkül egy "Bluefin-testing" nevű márka jönne
  // létre jóváhagyáskor.
  "bluefin-testing": "Bluefin",
  // ITIWIT → DECATHLON (F2.1-utó-51). A márkanév MEGVÁLTOZOTT: a decathlon.hu
  // ma mindenütt `DECATHLON` márkanevet tesz ki ugyanezekre a deszkákra, és a
  // saját forrásunk (`sources/decathlon.ts`) is így írja. Ha az „Itiwit" külön
  // márkaként maradna, ugyanaz a deszka KÉT márka alatt szóródna szét
  // aszerint, hogy a bolt a régi vagy az új nevet használja.
  "itiwit / decathlon": "Decathlon",
  itiwit: "Decathlon",
  decathlon: "Decathlon",
  // BESTWAY → HYDRO-FORCE (F2.1-utó-51). A Bestway SUP-vonalának neve
  // Hydro-Force, és a deszkák EZT a nevet viselik — a hivatalos bolt is így
  // hirdeti őket. A kötőjel nélküli írásmód ugyanolyan gyakori, a folding
  // pedig a szóközt nem tünteti el, tehát mindkét alak kell.
  bestway: "Hydro-Force",
  "hydro force": "Hydro-Force",
  "hydro-force": "Hydro-Force",
  hydroforce: "Hydro-Force",
  // Élesben mért eset (2026-08-20, sup-deszka.hu): UGYANAZ a márka két
  // írásmóddal — 6 jelölt „TooMuch", 4 „Too Much". Egybeírva a folding nem
  // hozza össze őket (a szóköz nem tűnik el), tehát két külön márka jönne
  // létre jóváhagyáskor, és a deszkák két név alatt szóródnának szét.
  toomuch: "Too Much",
  "too much": "Too Much",
  coasto: "Coasto",
  flowa: "Flowa",
  zray: "Zray",
  "z-ray": "Zray",
};

/** Zaj-szavak a modellnévben (a márkán és a méreten túl). */
const NOISE_WORDS = [
  "sup",
  "supboard",
  "paddleboard",
  "paddle board",
  "stand up paddle",
  "állítható",
  "felfújható",
  "deszka",
  "szett",
  "csomag",
  "set",
  "package",
  "inflatable",
  "isup",
  "i-sup",
  "új",
  "akció",
];

/** Az évjárat-felismerés ésszerű alsó korlátja (a SUP-piac ennél nem régebbi). */
const MIN_MODEL_YEAR = 2010;

/** 1 font kilogrammban — a font-only adatok átváltásához (funwaterboard.com). */
const KG_PER_POUND = 0.45359237;

const CM_PER_INCH = 2.54;
const CM_PER_FOOT = 30.48;

/** Ékezet- és kisbetű-semleges összehasonlító alak. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Bolti márkanév → kanonikus alak (alias-lista, majd whitespace-tisztítás). */
export function normalizeBrandName(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  // A ZÁRÓ „SUP" kategória-szó, nem márkajel: a boltok „Gladiator SUP"-ként
  // írják azt, ami a katalógusban „Gladiator" (élesben mért eltérés, ami e
  // nélkül a márka-egyezést a küszöb alá vinné).
  const trimmed = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+sup$/i, "");
  if (trimmed === "") return null;
  return BRAND_ALIASES[foldText(trimmed)] ?? trimmed;
}

/**
 * Évjárat kinyerése. Csak 4 jegyű, ésszerű tartományba eső szám számít, és a
 * jövőbe legfeljebb egy évet engedünk (a boltok előre hirdetik a következő
 * szezont) — így a „2024" évjárat és a „320" méret nem keveredik.
 */
export function extractModelYear(
  text: string,
  now = new Date(),
): number | null {
  const maxYear = now.getUTCFullYear() + 1;
  let found: number | null = null;
  for (const match of text.matchAll(/\b(20\d{2})\b/g)) {
    const year = Number(match[1]);
    if (year >= MIN_MODEL_YEAR && year <= maxYear) {
      // Több találatnál a LEGKÉSŐBBI a modellév (a leírásban gyakran szerepel
      // korábbi évszám is, pl. „a 2022-es modell utódja").
      found = found === null ? year : Math.max(found, year);
    }
  }
  return found;
}

/**
 * Termékcím → tiszta modellnév: márka-prefix, méret-jelölés, évjárat és
 * zaj-szavak nélkül. Ez megy az egyezés-keresésbe, ezért a determinizmus
 * fontosabb, mint a szépség.
 */
/**
 * AQUA MARINA CIKKSZÁM: `BT-23ATP`, `PA-25T320`, szóközzel is (`BT 26RAY`).
 *
 * A második két számjegy a MODELLÉV: `BT-19YD` = 2019-es Yoga Dock,
 * `PA-25T320` = 2025-ös Pure Air Tropic 320. Élesben ellenőrizve: 32 jelöltnél
 * szerepel ilyen kód, és MIND Aqua Marina — a prefixek `BT-` és `PA-`, az évek
 * 19-től 26-ig futnak, hézag nélkül.
 *
 * MIÉRT MÁRKÁHOZ KÖTVE: ez a gyártó saját cikkszám-konvenciója, nem általános
 * szabály. Egy másik márkánál ugyanez az alak mást jelenthet, és egy rossz
 * évjárat KÜLÖN modellt csinálna ugyanabból a deszkából.
 */
const AQUA_MARINA_CODE = /\b(?:BT|PA)[-\s]?(\d{2})[A-Z]{1,4}\d*\b/;

/**
 * A LÁB-HÜVELYK ÉS METRIKUS MÉRETJELÖLÉS kivétele a modellnévből.
 *
 * A TIPOGRÁFIAI láb-jel (’ U+2019, ′ U+2032) SZÁNDÉKOSAN nincs benne, pedig a
 * magyar boltok így írják („Atlas 12’0”"). Kipróbálva (2026-08-21): ha
 * levágnánk, a `PURE AIR Tropic 10′6″` és a `PURE AIR Tropic 10′10″` UGYANARRA
 * a névre normalizálódna — a SUP-nál viszont a méret maga a termék, tehát a
 * kettő összefésülhetővé válna. A méret a névben marad, amíg a modell↔méret
 * azonosítás nem külön mező.
 */
function stripSizeMarks(value: string): string {
  return value
    // MÉRET-HÁRMAS EGYBEN: `335 x 91.5 x 15 cm` (F2.1-utó-51,
    // bestwaystore.de). Az egyesével illesztő minták csak az EGYSÉGES tagot
    // (`15 cm`) vitték el, és a névben ott maradt a csonk: „Aqua Drifter with
    // seat 335 x 91.5 x". A hármas egyetlen alakzat — együtt kell kivenni,
    // MÉG a darabonkénti minták előtt.
    .replace(
      // Az egység MINDEN tagon állhat: `340 cm x 89 cm x 15 cm` (aqualing.hu),
      // nem csak a hármas végén (`335 x 91.5 x 15 cm`).
      /\d+(?:[.,]\d+)?\s*(?:cm|mm)?\s*[x×*]\s*\d+(?:[.,]\d+)?\s*(?:cm|mm)?\s*[x×*]\s*\d+(?:[.,]\d+)?\s*(?:cm|mm|m|inch|coll|"|”)?/gi,
      " ",
    )
    .replace(/\d+\s*'\s*\d*\s*(?:''|"|”|’’)?/g, " ")
    .replace(/\d+([.,]\d+)?\s*(cm|mm|m|inch|coll|"|”)\b/gi, " ");
}

/**
 * Modellév az Aqua Marina cikkszámából (felhasználói felismerés, 2026-08-21).
 *
 * MIÉRT SZÁMÍT: az évjárat nélkül a 2020-as és a 2025-ös Blade ugyanannak a
 * deszkának látszik, pedig más a mérete és a teherbírása. A kereskedői oldalak
 * az évet gyakran sehol nem írják ki — a cikkszámban viszont ott van.
 */
export function modelYearFromProductCode(
  text: string,
  brandName: string | null,
  now = new Date(),
): number | null {
  if (brandName === null || !/aqua\s*marina/i.test(brandName)) return null;
  const match = text.match(AQUA_MARINA_CODE);
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  if (year < MIN_MODEL_YEAR || year > now.getUTCFullYear() + 1) return null;
  return year;
}

export function cleanModelName(
  rawTitle: string,
  brandName?: string | null,
  /**
   * FORRÁS-SZINTŰ zajszavak (`crawl_config.titleNoiseWords`) — a globális
   * `NOISE_WORDS` mellé, azon a forráson, ahol mérve lettek.
   *
   * MIÉRT NEM GLOBÁLIS: a szavak nagy része MÁSHOL valódi modellnév-rész.
   * Élesben (funwaterboard.com) minden cím SEO-halmaz — „Cheap Polar Bear
   * 10′6″ Touring", „Best Paddle Boards Smiling Face Touring", „Stand Up For
   * Sale Arrow 12′7″ Racing" —, és a záró „Touring" is kulcsszó, nem
   * besorolás: MINDEN terméken ott áll, a deszkatípust a gyártó a
   * `Versatility` mezőben mondja meg. Ugyanez a „touring" viszont az
   * Indianánál VALÓDI modellnév-rész („Indiana 12'6 Touring"), ezért
   * globálisan tilos lenne kivenni.
   */
  noiseWords: readonly string[] = [],
  /**
   * A MÉRET A NÉV RÉSZE MARAD (`crawl_config.titleKeepSize`, F2.1-utó-50).
   *
   * Élesben (decathlon.hu) a modellnév a méret NÉLKÜL nem azonosít: a
   * „SUP szett, 9'6, felfújható, egy személynek, 80 kg-ig - 100-as" és a
   * „SUP szett, felfújható, 10'6 - 100-as" is puszta „100"-zá válna, és a
   * duplikátum-felismerés két KÜLÖNBÖZŐ deszkát vonna össze.
   */
  keepSize = false,
): string {
  // Az entitás-feloldás ITT történik, mert a nyers cím nem csak HTML-ből jön:
  // a Shopify `/products.json` és a JSON-LD `name` mezője is entitást ad
  // (`Indiana 12&#039;6 Touring`) — enélkül az `&#039;` a modellnév része lenne.
  // VÉDJEGY-JELEK: a `®`, `™` és `©` SOHA nem a modellnév része, viszont a
  // gyártói címekben sűrűn ott áll (F2.1-utó-51, bestwaystore.de: „Hydro
  // Force® SUP … Aqua Drifter™ with seat"). Kivétel nélkül eldobjuk — enélkül
  // ugyanaz a deszka két néven állhatna, attól függően, hogy a bolt kitette-e
  // a jelet, és a márkanév levágása után árva `™` maradna a név elején.
  let text = decodeEntities(rawTitle)
    .replace(/[®™©]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (brandName) {
    // A márkanevet bárhol kivesszük (nem csak prefixként): „Aqua Marina Vapor
    // 10'4" és „Vapor Aqua Marina" ugyanarra a modellnévre normalizálódik.
    const pattern = new RegExp(escapeRegExp(brandName), "gi");
    text = text.replace(pattern, " ");
  }

  if (!keepSize) text = stripSizeMarks(text);
  text = text
    .replace(/\b(20\d{2})(-(es|as|ös|os))?\b/g, " ")
    // A KERESKEDŐ ÁLTAL ODAÍRT TEHERBÍRÁS nem a modellnév része (felhasználói
    // jelzés, 2026-08-21): „PURE AIR Tropic 12'0" Aqua Marina | 170 kg",
    // „RAPID BT 22RP , 130kg ig", „Atlas 12'0" BT 23ATP 180 kg". A gyártó
    // hivatalos nevében ilyen sosincs, és két bolt kétféleképp írja oda —
    // vagyis a duplikátum-felismerést is rontja.
    .replace(/\d+([.,]\d+)?\s*kg\b(\s*(ig|-ig))?/gi, " ")
    // A CIKKSZÁM sem: az évjáratot már kiolvastuk belőle
    // (`modelYearFromProductCode`), a névben viszont csak zaj — és
    // boltonként más írásmóddal (`BT-23ATP` kontra `BT 23ATP`) két külön
    // modellnek látszana ugyanaz a deszka.
    .replace(new RegExp(AQUA_MARINA_CODE.source, "g"), " ");

  // A forrás-szintű zaj MEGY ELŐBB: a hosszabb, összetett kifejezések
  // („paddle boarding", „for sale") még egyben állnak, amikor illesztjük.
  for (const word of [...noiseWords, ...NOISE_WORDS]) {
    text = text.replace(wholeWordRegExp(word), " ");
  }

  return stripEdgeStopWords(
    text
      // A VESSZŐ IS ELVÁLASZTÓ (F2.1-utó-50). A decathlon.hu címei vesszős
      // felsorolások („SUP szett, 9'6, felfújható, egy személynek, 80 kg-ig -
      // 100-as"); a zajszavak kivétele után az árván maradt vesszők
      // BENNMARADTAK a névben („, , , 100"). Modellnév nem kezdődik és nem
      // végződik írásjellel.
      .replace(/[|/\\~·•–—,;-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/**
 * A név SZÉLÉN maradt kötőszó/névelő levágása.
 *
 * A zajszavak kivétele után gyakran árván marad egy elöljáró: a
 * `Funwater | Best Inflatable SUP for Kids Rocket 9′6″` címből a zaj
 * eltávolítása után `for Kids Rocket 9′6″` lett. Modellnév nem kezdődik és nem
 * végződik kötőszóval — ez nem tartalmi döntés, hanem nyelvtani.
 *
 * CSAK A SZÉLEKEN vág: a névben BELÜL ugyanezek a szavak valódi részek
 * lehetnek („Ride the Sunset").
 *
 * EGYBETŰS SZÓ SOSEM KERÜLHET IDE. Az angol „a" névelő kézenfekvőnek tűnt,
 * de a SUP-nál az egybetűs végződés VARIÁNS-JELÖLÉS: a Zray modellek
 * `Max Azure M2 A`, `Kids Saffron K8 B` alakúak, és a levágásuk két külön
 * deszkát olvasztana össze. Regressziós teszt őrzi (`normalize.test.ts`).
 */
const EDGE_STOP_WORDS = ["for", "with", "and", "the", "of", "az"];

function stripEdgeStopWords(value: string): string {
  let text = value;
  for (;;) {
    const words = text.split(" ").filter((word) => word !== "");
    if (words.length <= 1) return text;
    const first = foldText(words[0] ?? "");
    const last = foldText(words[words.length - 1] ?? "");
    if (EDGE_STOP_WORDS.includes(first)) text = words.slice(1).join(" ");
    else if (EDGE_STOP_WORDS.includes(last)) text = words.slice(0, -1).join(" ");
    else return text;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Egész szavas illesztés ÉKEZETES szavakra is. A `\b` itt használhatatlan: az
 * ASCII szó-karakterekre épül, ezért a „felfújható" végén álló `ó` után NEM ad
 * szóhatárt — a naiv `\bfelfújható\b` sosem illeszkedne.
 */
function wholeWordRegExp(word: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\d])${escapeRegExp(word)}(?![\\p{L}\\d])`,
    "giu",
  );
}

/** Tizedesvessző-toleráns szám-parse (a magyar boltok vesszőt írnak). */
function toNumber(raw: string): number | null {
  const value = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * Egyetlen mérték kiolvasása szövegből, cm-re váltva. Kezelt alakok:
 * `10'6"`, `10' 6''`, `320 cm`, `3,2 m`, `32"`, `32 inch`, `32 coll`.
 * Egyik sem illeszkedik → null (nem találgatunk mértékegység nélküli számból).
 */
export function parseDimensionCm(text: string): number | null {
  // TARTOMÁNY NEM MÉRET. Élesben mért eset (aquamarinahungary.com, ATLAS): a
  // termékoldal alján az EVEZŐ adatai állnak, köztük `hossza: 165-210cm` — az
  // állítható evezőé. Ebből 210 cm „deszkahossz" lett egy 366 cm-es deszkára.
  // Egyetlen deszka hossza sem tartomány, tehát ez biztosan nem a keresett
  // mező: inkább maradjon üresen, mint hogy hamis legyen.
  if (/\d\s*[-–—]\s*\d+\s*(?:cm|mm|m\b|''|"|”|″|inch|in\b|coll)/i.test(text)) {
    return null;
  }
  // A GYÁRTÓ SAJÁT, ZÁRÓJELES ÁTVÁLTÁSA ÜT MINDENT (F2.1-utó-50).
  //
  // Élesben (decathlon.hu) minden méret KÉT írásmóddal áll, az imperiálissal
  // elöl: `Hosszúság: 14' (426 cm)`, `Szélesség: 33" (84 cm)`,
  // `Vastagság: 4'75" (12 cm)`. Két baj is származott ebből:
  //
  //  * a `4'75"` alakot a láb-hüvelyk minta 4 láb + 75 HÜVELYKNEK olvasta
  //    (312 cm egy 12 cm vastag deszkára) — a gyártó a 4,75 hüvelyket írta
  //    így;
  //  * a címke-ablak ÁTNYÚLIK a következő sorba, és a láb-jeles minta a
  //    SZÖVEG BÁRMELY pontján illeszkedik: a `Szélesség` ablakában a KÖVETKEZŐ
  //    mező (`Vastagság: 14' …`) láb-értéke nyert a saját, közvetlenül a
  //    címke mellett álló centiméteres értéke helyett.
  //
  // A zárójeles alak ÖNLEÍRÓ: közvetlenül egy imperiális érték UTÁN álló
  // `(… cm)` csakis annak az átváltása lehet — a gyártó saját, szerkesztett
  // adata. Ezért ez fut ELŐBB, és a szöveg ELSŐ ilyen párja nyer.
  const parenthesised = text.match(
    /\d+(?:[.,]\d+)?\s*(?:['′’]\s*\d*(?:[.,]\d+)?\s*(?:''|"|”|″)?|''|"|”|″)\s*\(\s*(\d+(?:[.,]\d+)?)\s*cm\s*\)/i,
  );
  if (parenthesised) {
    const value = toNumber(parenthesised[1] ?? "");
    if (value !== null) return round1(value);
  }

  // A `(?!')` védi ki, hogy egy dupla-aposztróffal írt hüvelyk-jel (`32''`,
  // gyakori ASCII-helyettesítő a valódi ″ karakterre — élesben mért eset,
  // indiana-paddlesurf.com "Width Foot/Inch: 32''") ne illeszkedjen láb-
  // jelként (az első `'`-t követő MÁSODIK `'` enélkül "elveszett" karakterré
  // vált volna, a 32-t pedig lábnak olvastuk volna hüvelyk helyett — 32 láb =
  // 975 cm a valós 81,3 cm helyett).
  // A tipográfiai PRIME-ok (′ U+2032 láb, ″ U+2033 hüvelyk) is számítanak:
  // élesben (funwaterboard.com) a méret `10′6″ * 33″ * 6″` alakban áll, és a
  // sima aposztrófra szűrve az egész sor láthatatlan maradt.
  // A JOBB OLDALI GÖRBE IDÉZŐJEL (’ U+2019) is láb-jel: a szövegszerkesztők és
  // a CMS-ek „okos idézőjel" funkciója némán ezzé alakítja az aposztrófot.
  // Élesben (funwaterboard.com) a leírás `Its 11’6” length and 33” width`
  // alakú — a `’`-re nem szűrve a `11’` láb ELVESZETT, és a hosszba a
  // vastagság (6” = 15,2 cm) került.
  // A GÖRBE IDÉZŐJEL (’ U+2019) CSAK AKKOR láb-jel, ha a szöveg nem ad
  // metrikus értéket (F2.1-utó-47).
  //
  // MIÉRT A FELTÉTEL: a `’` kétértelmű. Láb-jelnek szánva is előfordul — a
  // CMS-ek „okos idézőjel" funkciója némán ezzé alakítja az aposztrófot
  // (funwaterboard.com: `Its 11’6” length and 33” width`, ahol nélküle a
  // hosszba a vastagság került) —, de a szövegben ugyanez a karakter
  // aposztróf vagy idézőjel is lehet.
  //
  // ÉLESBEN MÉRT ÁR (indiana-paddlesurf.com): feltétel NÉLKÜL bevezetve a
  // spec `Length CM: 347,5 cm Length Foot/Inch:: 11’5''` sorában a SZÁMÍTOTT
  // láb-hüvelyk (348 cm) ütötte a gyártó SAJÁT metrikus értékét. Ahol tehát
  // van centiméter, ott nem kockáztatunk: a metrikus a közölt adat, az
  // imperiális a belőle származtatott.
  const hasMetric = /\d+(?:[.,]\d+)?\s*cm\b/i.test(text);
  const footMarks = hasMetric ? "'\u2032" : "'\u2032\u2019";
  const feetInches = text.match(
    new RegExp(
      `(\\d+)\\s*[${footMarks}](?![${footMarks}])\\s*(\\d+(?:[.,]\\d+)?)?\\s*(?:''|"|\u201d|\u2033|\u2019\u2019)?`,
    ),
  );
  if (feetInches) {
    const feet = toNumber(feetInches[1] ?? "");
    const inches = feetInches[2] ? toNumber(feetInches[2]) : 0;
    if (feet !== null && inches !== null) {
      return round1(feet * CM_PER_FOOT + inches * CM_PER_INCH);
    }
  }

  // KIÍRT LÁB: `11 feet length` (funwaterboard.com). A rövidítés-only minta
  // ezt nem látta, és a hossz a mondat KÖVETKEZŐ értékéből (32 inches) jött.
  const feet = text.match(/(\d+(?:[.,]\d+)?)\s*(?:feet|foot|ft)\b/i);
  if (feet) {
    const value = toNumber(feet[1] ?? "");
    if (value !== null) return round1(value * CM_PER_FOOT);
  }

  const cm = text.match(/(\d+(?:[.,]\d+)?)\s*cm\b/i);
  if (cm) {
    const value = toNumber(cm[1] ?? "");
    if (value !== null) return round1(value);
  }

  const mm = text.match(/(\d+(?:[.,]\d+)?)\s*mm\b/i);
  if (mm) {
    const value = toNumber(mm[1] ?? "");
    if (value !== null) return round1(value / 10);
  }

  const meter = text.match(/(\d+(?:[.,]\d+)?)\s*m\b/i);
  if (meter) {
    const value = toNumber(meter[1] ?? "");
    if (value !== null) return round1(value * 100);
  }

  const inch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:''|"|\u201d|\u2033|inch|in\b|coll)/i);
  if (inch) {
    const value = toNumber(inch[1] ?? "");
    if (value !== null) return round1(value * CM_PER_INCH);
  }

  return null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Címke-szinonimák a magyar és angol spec-táblázatokhoz. */
const SPEC_LABELS = {
  // Bare "length"/"width"/"thickness" — élesben mért ütközés (2026-07-31,
  // bluefinsupboards.eu): egy deszka+evező CSOMAG oldalán az evező saját
  // "Paddle Length" címkéje is illeszkedne rájuk, és az EVEZŐ hosszát írná a
  // deszka hosszaként. A `paddle`-előzményű találatokat a `valueAfterLabel`
  // kizárja (lásd lent).
  // A LENGYEL címkék a u1.net.pl „Parametry" táblájából (F2.1-utó-53).
  lengthCm: ["hosszúság", "hossz", "length", "długość"],
  // A MELLÉKNÉVI alak („33\" wide", „6\" thick") a prózában gyakori, és a
  // hozzá tartozó érték a címke ELŐTT áll — azt a `valueAfterLabel` első ága
  // olvassa. A főnévi alak (`width`/`thickness`) MEGELŐZI a listában, tehát
  // ahol a forrás rendes spec-táblát ad, ott a viselkedés változatlan.
  widthCm: ["szélesség", "szeles", "width", "wide", "szerokość"],
  // A „thick" melléknévi alak SZÁNDÉKOSAN NINCS itt: kipróbálva (2026-08-28)
  // elrontotta a Jobe-t, ahol a próza az anyagvastagságról ír. A „wide" viszont
  // biztonságos maradt — a mérés döntött, nem a szimmetria.
  // A LENGYEL „wysokość" (magasság) a deszka VASTAGSÁGA — a u1.net.pl így
  // nevezi (`Wysokość: 6" / 15 cm`). A „grubość" SZÁNDÉKOSAN NINCS itt, pedig
  // az a szó szerinti „vastagság": ugyanezen a lapon `Grubość burty` és
  // `Grubość materiału` néven az ANYAG vastagsága áll milliméterben
  // (0,75 mm) — abból 0,08 cm-es deszka lenne.
  thicknessCm: ["vastagság", "magasság", "thickness", "wysokość"],
  // „Űrtartalom (l)" — a magyar boltok gyakoribb szava a térfogatra
  // (F2.1-utó-52, aqualing.hu).
  volumeL: ["térfogat", "űrtartalom", "urtartalom", "volumen", "volume", "pojemność"],
  // A csupasz „weight" szándékosan hiányzik: a „Max weight: 140 kg" sorban
  // beleillene, és a TEHERBÍRÁST írná a deszka saját súlyaként.
  // A „net weight" ELÉG specifikus ahhoz, hogy ne ütközzön a teherbírással —
  // az Aqua Marina hivatalos adatlapja (aquamarina.com) ezt a címkét használja
  // a deszka saját súlyára, „MAX. PAYLOAD" mellett.
  weightKg: [
    // „Súly (csak a deszka): 8,4 kg" — a decathlon.hu ugyanabban a blokkban
    // sorolja fel a deszka, a teljes szett, az evező és a pumpa tömegét
    // (F2.1-utó-50). A zárójeles pontosítás a gyártó SAJÁT elhatárolása, és a
    // legspecifikusabb címke: ezért áll elöl, a puszta „súly" előtt.
    "súly (csak a deszka)",
    "deszka súlya",
    // „Deszka nettó tömege: 11,6 kg" (aqualing.hu) — a gyártó szett-tömegétől
    // elhatárolt, kimondottan a DESZKA tömege.
    "nettó tömeg",
    "netto tomeg",
    "saját súly",
    "súly",
    "tömeg",
    "board weight",
    "net weight",
    // Élesben mért címke (funwaterboard.com): „Item Weight: 28 Pounds". A
    // puszta „weight" itt SEM jöhet szóba (a teherbírás címkéje is azt viseli:
    // „Max User Weight"), az „item weight" viszont egyértelműen a termék
    // saját tömege — és nem ütközik a szomszédos „Package Weight"-tel.
    "item weight",
    // Élesben mért címke (boteboard.com, 2026-08-29): „Avg. Weight: 20 LBS" —
    // a gyártó a deszka saját tömegét ÁTLAGKÉNT közli (a kézi ragasztás miatt
    // modellenként szór). Ugyanazon a lapon áll a „Loaded Bag Weight: 29 LBS"
    // (a becsomagolt szett) és a „Seat Weight: 5.6 LBS" (a tartozék ülés) —
    // egyikbe sem illik bele az „avg", ezért a szűk címke elhatárol.
    "avg. weight",
    "avg weight",
    "average weight",
  ],
  maxLoadKg: [
    "teherbírás",
    "terhelhetőség",
    "max terhelés",
    "maximális terhelés",
    // Élesben mért címke (aquamarinahungary.com, BLADE Windsurf):
    // „Max. hasznos teher: 120 kg". A „teher" SZÓTŐ önmagában túl laza lenne
    // (teherautó, tehermentes), a „hasznos teher" viszont egyértelmű — ez a
    // payload magyar megfelelője.
    "hasznos teher",
    // Red Paddle (red.equipment): a márka SEHOL nem ír terhelési mezőt, a
    // leírásában viszont kimondja: „…for riders up to 100kg". Ugyanaz a
    // fajta korlát, mint a Jobe „Recommended rider weight"-je (lásd lent),
    // csak mondatba ágyazva — és ez az EGYETLEN terhelési adata.
    "riders up to",
    // Élesben mért címke (Bluefin): "Max User Weight" — a "max weight"
    // RÉSZSTRING-illesztés ezt nem fogja meg, mert közte van a "user" szó.
    "max user weight",
    "max load",
    "max weight",
    "capacity",
    // A MAXIMÁLIS TERHELÉS ELŐBBRE VALÓ AZ AJÁNLOTTNÁL (felhasználói döntés,
    // 2026-08-28: „szinte mindenütt a maximális terhelést írtuk be").
    //
    // Élesben (aquatone.com) a spec-tábla KÉT terhelési sort ad, ebben a
    // sorrendben: `REC. PAYLOAD / < 60 kg` és `MAX. PAYLOAD / < 75 kg`. A
    // címke-kereső az ELSŐ találatot veszi, tehát a puszta „payload" needle
    // az AJÁNLOTT értéket adta — a katalógus többi sorával összemérhetetlenül.
    // A specifikusabb needle ezért ELŐBB áll: a listát sorrendben járjuk be,
    // így a `max. payload` akkor is nyer, ha a lapon a `rec.` sor van elöl.
    //
    // MINDKÉT ÍRÁSMÓD KELL: a pont a címkében van („MAX. PAYLOAD"), és a
    // részstring-illesztés miatt a pont nélküli needle nem fogná meg.
    "max. payload",
    "maximum payload",
    "max payload",
    // Aqua Marina hivatalos adatlap (aquamarina.com): „MAX. PAYLOAD".
    // A `kg`-kötelezettség miatt a mellette kiírt font-érték („308 lbs /
    // 140 kg") nem téveszt meg — a 140 nyer, nem a 308.
    "payload",
    // NÉMET CÍMKÉK (F2.1-utó-51, bestwaystore.de). Az angol nyelvi ágon is
    // maradhat NÉMET spec-blokk: a tíz Hydro-Force deszkából egynél (a 2025-ös
    // Oceana) a bolt fordítása hiányos, és a lap `Maximale Belastbarkeit:
    // 120 kg`-ot ír `Weight capacity` helyett. A méret ettől még kijött (a
    // hármas-minta nyelvfüggetlen), a TEHERBÍRÁS viszont némán üresen maradt —
    // az pedig KÖTELEZŐ mező: nélküle a Deszkaválasztó kizárja a deszkát.
    // Mindkét német szó egyértelmű terhelési fogalom, ütközés nincs.
    "belastbarkeit",
    "tragkraft",
    // LENGYEL: `Rekomendowane/ maksymalne obciążenie` ⏎ `150kg/ 300kg`. A
    // mező KÉT számot ad, és az AJÁNLOTT áll elöl — a `parseWeightKg` az
    // elsőt veszi, ami itt a helyes: a 300 kg a 350 literes térfogathoz
    // tartozó merülési határ (ugyanaz az arkhimédészi csapda, mint a
    // decathlon.hu-n), az evezősre vonatkozó valós korlát a 150.
    "obciążenie",
    // Jobe (jobesports.com): „Recommended rider weight: Up to 160kg" — a
    // márka SEHOL nem ír „max load"-ot, ez az EGYETLEN terhelési korlátja.
    // Felhasználói döntés (2026-08-20): ezt vesszük teherbírásnak.
    //
    // Miért vállalható: az evezős-súlyhatár a gyártó saját korlátja, és
    // KONZERVATÍV — alacsonyabb, mint a teljes terhelhetőség, ami a
    // felszerelést is beleérti. A Deszkaválasztó biztonsági szűrője ezzel
    // inkább kizár, mint beenged. Precedens: a Bluefin „Max User Weight"-jét
    // ugyanígy vesszük (lásd fent).
    "rider weight",
  ],
} as const satisfies Record<
  keyof Omit<BoardSpecs, "inflatable">,
  readonly string[]
>;

/**
 * Összevont "Hossz × Szélesség × Vastagság" méret-sor címkéi. "méret" (nem
 * csak "méretek") — élesben mért: aquamarinahungary.com "Mérete (366 x 84 x
 * 15 cm)" alakot ír, a rövidebb tő mindkét szóalakra illeszkedik.
 */
const DIMENSIONS_LABELS = ["méret", "dimensions"];

/**
 * Egy CÍMKÉZETT érték kiolvasása: a címke után következő ~40 karakterből
 * keressük a mértéket. A szűk ablak szándékos — enélkül a „Hosszúság" címke
 * egy jóval későbbi, más sorhoz tartozó számot szedne fel.
 *
 * `excludePrecededBy`: ha a címke-találat közvetlenül egy tiltott szó után
 * áll (pl. "Paddle Length", "Bag Dimensions"), a találatot ÁTUGORJA és a
 * SZÖVEGBEN KÉSŐBBI előfordulást keresi tovább — nem csak az elsőt nézi.
 *
 * A címke UTÁN álló szótöredéket is ellenőrizzük: a magyar INSTRUMENTÁLIS
 * rag (birtokos + "-val/-vel", pl. "hosszúság**ával**", "szélesség**ével**"
 * egy leíró mondatban: "366 cm hosszúságával, 84 cm szélességével és 15 cm
 * vastagságával") a bare címkeszóval KEZDŐDIK, tehát substring-illesztéssel
 * hamisan találatot ad, és a mondatban közeli, de ROSSZ dimenzió számát
 * szedi fel (élesben mért hiba, 2026-08-13: sup-deszka.hu "MONSTER 12'0" —
 * a leírás ragozott mondata miatt a hossz mezőbe a szélesség értéke, a
 * szélesség mezőbe a vastagság értéke került). SZŰKEN csak ezt a mintát
 * (`[ae]v[ae]l`, pl. "aval"/"evel") zárjuk ki, NEM minden utána álló
 * kisbetűt — a "méret" címkének a birtokos alakjaira ("mérete", "méretei")
 * továbbra is illeszkednie KELL, ezek nem instrumentálisok.
 */
function valueAfterLabel(
  text: string,
  labels: readonly string[],
  excludePrecededBy: readonly string[] = [],
  excludeFollowedBy: readonly string[] = [],
): string | null {
  // KÉTMENETES keresés. Elsőként csak a KETTŐSPONTTAL zárt címkét fogadjuk el
  // („Volume: 379L"), mert azt csak spec-táblázat írja; a marketing-próza
  // ugyanazokat a szavakat kötetlenül használja.
  //
  // ÉLESBEN MÉRT HIBA (zraysports.com, Max Azure 11'6"): a termékoldalon a
  // „Related Products" blokk MEGELŐZI a spec-táblát, és MÁS deszkákról ír —
  // „[HIGHER VOLUME; CAPACITY] The weight capacity is 152 kg". A laza
  // illesztés emiatt a SZOMSZÉD termék teherbírását (152 kg) adta a 170 kg
  // helyett, a térfogatot pedig egyáltalán nem találta meg. A teherbírás
  // BIZTONSÁGI mező (a Deszkaválasztó ez alapján ajánl), tehát ez nem
  // szépséghiba.
  //
  // A második menet a régi, laza viselkedés — a kettőspont nélküli
  // spec-táblák (aquamarina.com: „NET WEIGHT\n9.3 kg") így változatlanul
  // működnek.
  return (
    labelSearch(text, labels, excludePrecededBy, excludeFollowedBy, true) ??
    labelSearch(text, labels, excludePrecededBy, excludeFollowedBy, false)
  );
}

/**
 * Ékezet-hajtás INDEXHŰEN: a kimenet karakterenként ugyanolyan hosszú, mint a
 * bemenet, tehát a `folded`-ben talált pozícióval az EREDETI szöveg is
 * vágható.
 *
 * MIÉRT KELL (élesben mért hiba, zraysports.com): a `foldText` NFD-re bont,
 * majd a diakritikus jeleket törli. Az ékezetes latin betűnél ez hossz-semleges
 * („é" → „e"+U+0301 → „e"), a HANGUL szótagoknál viszont NEM: a site az
 * ikonjaihoz `&#xb133;`-féle karaktereket használ, amiket az NFD 3 jamóra bont,
 * és azok nem diakritikusak — a hajtott szöveg így KÉT karakterrel hosszabb
 * lett minden ilyen ikonnál. A `valueAfterLabel` a hajtott szövegben talált
 * indexszel vágta az EREDETIT, ezért a „Volume: 379L" ablak „9L"-ként indult,
 * és 379 helyett 9 litert olvastunk ki.
 *
 * Ez csendes, súlyos hiba: a spec-mezők közt ott a teherbírás és a térfogat,
 * amikre a Deszkaválasztó BIZTONSÁGI döntést épít. Az elcsúszás bármilyen
 * nem hossz-semlegesen bomló karakternél előjön, nem csak ezen az oldalon.
 */
/**
 * Súly/teherbírás egy címke utáni ablakból, kilogrammban.
 *
 * KÉT SORNÁL nem megy tovább: a címke és az értéke legfeljebb egymás alatt
 * áll. Élesben (funwaterboard.com) a `Capacity` ablaka átnyúlt a KÖVETKEZŐ
 * mezőbe (`Capacity / 330LBS / Weight / 12.5KG …`), és a teherbírásba a
 * DESZKA SÚLYA került — 12,5 kg a valós 150 helyett.
 *
 * A `kg` továbbra is ELSŐBBSÉGET élvez: ahol a gyártó mindkettőt kiírja
 * („308 lbs / 140 kg"), a kilogramm nyer. Font-átváltás CSAK akkor, ha
 * kilogramm egyáltalán nincs — az veszteségmentes, nem találgatás.
 */
function parseWeightKg(window: string): number | null {
  const head = window.split("\n").slice(0, 2).join("\n");
  // A KIÍRT egységnév ugyanolyan jó, mint a rövidítés. Élesben
  // (funwaterboard.com): `Item Weight: 28 Pounds`, `Package Weight: 18.87
  // Kilograms` — a rövidítés-only minta ezeket nem látta.
  const kg = head.match(/(\d+(?:[.,]\d+)?)\s*(?:kg\b|kilogramm?s?\b)/i);
  if (kg) return toNumber(kg[1] ?? "");
  const lbs = head.match(/(\d+(?:[.,]\d+)?)\s*(?:lbs?|pounds?)\b/i);
  if (lbs) {
    const value = toNumber(lbs[1] ?? "");
    return value === null ? null : round1(value * KG_PER_POUND);
  }
  return null;
}

/**
 * Kétoszlopos spec-tábla MÉRTÉKEGYSÉG NÉLKÜL: a címke a saját sorában áll, és
 * a KÖVETKEZŐ sor egyetlen puszta szám. Az egységet ilyenkor a MEZŐ adja
 * (térfogat → liter, teherbírás és súly → kilogramm) — pontosan úgy, ahogy az
 * olvasó is érti.
 *
 * ÉLESBEN MÉRT (gladiatorsup.com):
 *   Board weight / 9,5 / Volume / 245 / Maximum load capacity / 140
 * A gyártó KÖZLI az adatot, csak nem ismétli meg mellette az egységet. A
 * korábbi állapotban ezért maradt üresen a térfogat és a teherbírás — az a MI
 * korlátunk volt, nem a forrásé.
 *
 * MIÉRT NEM VESZÉLYES ez a lazítás, pedig „puszta számból nem találgatunk":
 *  * a címke-sornak PONTOSAN a címkének kell lennie (semmi más szöveg),
 *  * a következő sornak PONTOSAN egy számnak (legfeljebb „up to" előtaggal),
 *  * és csak a MÁR ÜRESEN MARADT mezőket tölti — az egységes írásmód mindig üt.
 * Prózában ez az alakzat nem fordul elő; ez a shape maga a táblázat.
 *
 * A MÉRETEKET SZÁNDÉKOSAN nem tölti: ott a mértékegység dönti el, hogy cm-ről,
 * hüvelykről vagy lábról van szó — egység nélküli hossz-számot tippelni valódi
 * hiba lenne (32 hüvelyk kontra 32 cm).
 */
/**
 * A CSAK KETTŐSPONTOT tartalmazó sor átugrása (F2.1-utó-52, aqualing.hu).
 *
 * A bolt attribútum-táblája HÁROM sorba tördeli az adatot — címke, kettőspont,
 * érték —, mert mindhárom külön cellában áll. A „következő sor az érték"
 * alakzat enélkül a kettőspontot olvasná értéknek, és a tábla EGYETLEN mezője
 * sem jönne át. Egy magában álló kettőspont sosem érték.
 */
function valueLineAfter(lines: readonly string[], i: number): string {
  const next = lines[i + 1] ?? "";
  return /^[:：]$/.test(next) ? (lines[i + 2] ?? "") : next;
}

/**
 * MÉRET A TÁBLÁZATBÓL, HA AZ EGYSÉG A CÍMKÉBEN ÁLL (F2.1-utó-52, aqualing.hu).
 *
 * A `fillFromLabelledLines` doc-kommentje szerint a méreteket szándékosan NEM
 * töltjük puszta számból: ott a mértékegység dönti el, hogy 32 hüvelykről vagy
 * 32 centiméterről van szó. A `Hosszúság (cm)` ⏎ `305` alak viszont nem
 * találgatás — a bolt KIÍRTA az egységet, csak a címkébe, nem az érték mellé.
 *
 * MIÉRT FUT EZ ELSŐKÉNT, minden más méret-olvasó ELŐTT: mert ez a
 * legmegbízhatóbb alak, és a lazább minták elronthatják. Élesben (aqualing.hu)
 * a `Vastagság (cm) / 12` cella helyes 12-je helyett 12000 került a mezőbe,
 * amit egy prózai minta szedett fel a szomszédos `Max. …(kg)` sorokból. A
 * szerkesztett táblázat ÜT a szabad szövegen; a többi olvasó utána már csak a
 * MÉG ÜRES mezőket tölti.
 */
function fillDimensionsFromLabelledLines(text: string, specs: BoardSpecs): void {
  const lines = text.split("\n").map((line) => line.trim());
  for (let i = 0; i < lines.length - 1; i += 1) {
    const label = foldText(lines[i] ?? "").replace(/\s*[:：]$/, "");
    if (label === "" || label.length > 40 || /\d/.test(label)) continue;
    if (PACKAGE_QUALIFIERS.some((q) => label.includes(foldText(q)))) continue;
    const unit = /\((cm|mm)\)/.exec(label)?.[1];
    if (unit === undefined) continue;
    const bare = valueLineAfter(lines, i).match(/^(\d+(?:[.,]\d+)?)$/);
    if (bare === null) continue;
    for (const key of ["lengthCm", "widthCm", "thicknessCm"] as const) {
      if (specs[key] !== null) continue;
      if (!SPEC_LABELS[key].some((c) => label.includes(foldText(c)))) continue;
      const value = toNumber(bare[1] ?? "");
      if (value !== null) specs[key] = unit === "mm" ? round1(value / 10) : value;
      break;
    }
  }
}

function fillFromLabelledLines(text: string, specs: BoardSpecs): void {
  const fields = ["volumeL", "maxLoadKg", "weightKg"] as const;
  const lines = text.split("\n").map((line) => line.trim());
  for (let i = 0; i < lines.length - 1; i += 1) {
    const label = foldText(lines[i] ?? "").replace(/\s*[:：]$/, "");
    // A címke-sor legyen RÖVID és szám nélküli — így egy prózai mondat, ami
    // véletlenül tartalmazza a címkeszót, nem minősül címkének. A valós
    // címkék többszavasak („Maximum load capacity"), ezért nem pontos
    // egyezést kérünk, hanem tartalmazást ezen a szűk soron belül.
    if (label === "" || label.length > 40 || /\d/.test(label)) continue;
    // A TARTOZÉK CÍMKÉJE NEM A DESZKÁÉ. Élesben (aqualing.hu) a tábla
    // `Max. evezős súly (kg)` sora a „súly" needle-re illeszkedne, és az
    // EVEZŐS megengedett testsúlyát írná a deszka tömegébe.
    if (PACKAGE_QUALIFIERS.some((q) => label.includes(foldText(q)))) continue;
    const next = valueLineAfter(lines, i);
    const bare = next.match(/^(?:up to|max\.?|~)?\s*(\d+(?:[.,]\d+)?)$/i);

    for (const field of fields) {
      if (specs[field] !== null) continue;
      if (
        bare &&
        SPEC_LABELS[field].some((candidate) => label.includes(foldText(candidate)))
      ) {
        specs[field] = toNumber(bare[1] ?? "");
        break;
      }
      // MÁSODIK ALAK: az érték a saját sorában áll, de EGYSÉGGEL.
      if (BARE_LINE_LABELS[field].includes(label)) {
        const value = parseUnitLine(field, next);
        if (value !== null) {
          specs[field] = value;
          break;
        }
      }
    }
  }
}

/**
 * A CSUPASZ címkék — kizárólag a „címke a SAJÁT SORÁBAN" alakzatban szabad
 * őket használni, PONTOS sor-egyezéssel (F2.1-utó-47).
 *
 * MIÉRT KÜLÖN LISTA, és miért nem a `SPEC_LABELS`-be kerülnek: szabad
 * szövegben mindegyik ütközne. A puszta „weight" ott ráfutna a TEHERBÍRÁS
 * címkéjére („Max User Weight"), a marketingszóra („Lightweight and easy to
 * inflate/deflate") és a CSOMAG tömegére („Package Weight") is — épp ezért
 * nincs a `SPEC_LABELS.weightKg`-ban. Ha viszont a címke EGYEDÜL alkot egy
 * sort (pontos egyezés), és a következő sor EGYETLEN szám + egység, akkor az
 * már nem próza, hanem kétoszlopos táblázat: a `Lightweight and easy to
 * inflate/deflate` sor nem egyenlő a „weight" címkével, a `Package Weight`
 * sem.
 *
 * ÉLESBEN MÉRT (funwaterboard.com, 2026-08-28): a spec-rács így áll —
 *   Capacity / 350LBS / Weight / 12.74KG / Pressure / 12-15PSI
 * A teherbírás a `SPEC_LABELS`-en át megvolt, a SÚLY viszont mind a hét
 * mintázott oldalon üresen maradt. Ez `0/N` alak: a kinyerés hibája, nem
 * termékenkénti ügy.
 */
const BARE_LINE_LABELS: Record<"volumeL" | "maxLoadKg" | "weightKg", readonly string[]> = {
  volumeL: ["volume", "urtartalom", "terfogat"],
  maxLoadKg: ["capacity", "max load", "load capacity"],
  // A „sup weight" ugyanaz a mező más néven (funwaterboard.com, egyes lapokon).
  weightKg: ["weight", "sup weight", "board weight", "suly", "tomeg"],
};

/**
 * Egy ÖNÁLLÓ érték-sor a mezőhöz illő egységgel (`12.74KG`, `350LBS`,
 * `245 L`). A `^…$` horgony a lényeg: a sorban NINCS más — így egy mondat,
 * amiben véletlenül szerepel egy szám és egy „kg", nem minősül értéknek.
 */
function parseUnitLine(
  field: "volumeL" | "maxLoadKg" | "weightKg",
  line: string,
): number | null {
  const text = line.trim();
  if (field === "volumeL") {
    const match = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:l|liters?|litres?)$/i);
    return match ? toNumber(match[1] ?? "") : null;
  }
  // KETTŐS ÍRÁSMÓD egy sorban: `6.8 kg / 15 lbs`, `< 75 kg / 165 lbs`
  // (aquatone.com). A sor AKKOR érték-sor, ha CSAK számokból, egységekből és
  // elválasztókból áll — egy mondat így sem minősül annak. A „kisebb mint"
  // jel megengedett előtag: a gyártó a terhelési korlátot így írja.
  if (!/^[<~≤]?\s*\d+(?:[.,]\d+)?\s*[a-z]+(?:\s*[/|]\s*\d+(?:[.,]\d+)?\s*[a-z]+)?$/i.test(text)) {
    return null;
  }
  // A `kg` ELSŐBBSÉGE és a font-átváltás szabálya ugyanaz, mint a
  // címke-ablaknál — ezért ugyanaz a függvény dönt.
  return parseWeightKg(text);
}

/**
 * A pozíció zárójelen BELÜL van-e.
 *
 * ÉLESBEN MÉRT, CSENDES ADATHIBA (gladiatorsup.com): a méret-sor címkéje
 * `Dimensions (length/width/thickness)`, és a zárójelben ott a „length", a
 * „width" és a „thickness" szó is. A címke-kereső ezeket VALÓDI címkének vette,
 * és a mögöttük álló szövegből mind a három mezőbe ugyanazt a 15-öt írta
 * (354 × 86 × 15 helyett 15 × 15 × 15). Nem hiányzó adat lett belőle, hanem
 * HAMIS — ez a rosszabbik fajta.
 *
 * Spec-táblázat SOHA nem teszi zárójelbe a saját címkéjét; a magyarázat igen.
 */
function isInsideParens(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 80), index);
  const open = before.lastIndexOf("(");
  if (open < 0) return false;
  if (before.slice(open).includes(")")) return false;
  return text.slice(index, index + 80).includes(")");
}

/** A címke után ennyi karakterből keressük az értéket (szűk, szándékosan). */
const VALUE_WINDOW_CHARS = 40;

/**
 * Az érték-ablak a címke után — a KÖZVETLENÜL utána álló zárójeles
 * magyarázatot ÁTUGORVA.
 *
 * ÉLESBEN MÉRT (gladiatorsup.com): a méret-sor így néz ki:
 * `Dimensions (length/width/thickness) 354 х 86 х 15 cm`. A zárójel 26
 * karakter, tehát a szűk ablakból már csak `354 х 86 х 1` fért bele — a
 * mértékegység lemaradt, és a hármas minta (ami egységet KÖVETEL) nem
 * illeszkedett. Az ablak általános tágítása rossz válasz lenne: attól a
 * szomszédos mezők értékei szivárognának be. A zárójel viszont
 * egyértelműen a címke magyarázata, nem érték — átugorható.
 */
function windowAfterLabel(text: string, from: number): string {
  const paren = text
    .slice(from, from + VALUE_WINDOW_CHARS)
    .match(/^\s*\([^)]*\)/);
  const start = paren ? from + paren[0].length : from;
  return text.slice(start, start + VALUE_WINDOW_CHARS);
}

function foldForIndex(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i] as string;
    const folded = foldText(ch);
    // Ami nem pontosan egy karakterre hajlik (hangul, surrogate-fél, önálló
    // kombináló jel), az marad, ahogy volt — címke úgysem áll belőle.
    out += folded.length === 1 ? folded : ch;
  }
  return out;
}

function labelSearch(
  text: string,
  labels: readonly string[],
  excludePrecededBy: readonly string[],
  excludeFollowedBy: readonly string[],
  requireColon: boolean,
): string | null {
  const folded = foldForIndex(text);
  for (const label of labels) {
    const needle = foldText(label);
    let searchFrom = 0;
    for (;;) {
      const index = folded.indexOf(needle, searchFrom);
      if (index < 0) break;
      searchFrom = index + needle.length;

      // `includes`, nem szigorú `endsWith` — a magyar toldalékolás miatt
      // (pl. "szállítási" a "szállítás" kizáró szóhoz képest "-i" végű
      // melléknévi alak) egy pontos végződés-egyezés túl törékeny lenne.
      const before = folded.slice(Math.max(0, index - 20), index);
      const excluded = excludePrecededBy.some((word) =>
        before.includes(foldText(word)),
      );
      if (excluded) continue;

      const after = folded.slice(
        index + needle.length,
        index + needle.length + 6,
      );
      if (/^[ae]v[ae]l/.test(after)) continue;
      // Az első menetben KÖTELEZŐ a kettőspont (esetleg szóköz után) —
      // a spec-táblázat írásmódja.
      //
      // A MAGYAR BIRTOKOS TOLDALÉK is átmegy (`súlya:`, `mérete:`,
      // `terhelhetősége:`, `hossza:`), mert a magyar boltok így címkéznek.
      // Élesben mért hiba (aquamarinahungary.com, ATLAS): a `paddleboard
      // súlya: 11 kg` sor kettőspontosnak sem számított, ezért a kettőspontos
      // menet a lap alján álló EVEZŐ `Súly:` címkéjét találta meg — és a
      // deszka súlya üresen maradt. Három betűnél többet nem engedünk: az már
      // másik szó lenne, nem toldalék.
      // A TELJES SZÉLESSÉGŰ kettőspont (U+FF1A) ugyanolyan spec-tábla-jel, mint
      // az ASCII. Élesben (funwaterboard.com): `Capacity： 300 Pounds` — a
      // kínai eredetű sablonok ezt írják, és e nélkül csak a laza menet fogta.
      if (requireColon && !/^[a-z]{0,3}\s*[:：]/.test(after)) continue;
      // ZÁRÓJELEN BELÜLI címkeszó nem címke, hanem MAGYARÁZAT.
      if (isInsideParens(text, index)) continue;

      // HÁROM HELY, A LEGSZIGORÚBBTÓL. Élesben mért hiba (sup-deszka.hu, Pure
      // Air FREEDOM): a teherbírásba a DESZKA SÚLYA került — 8,8 kg a valós
      // 150 helyett. A biztonsági mezőkben ez a legveszélyesebb hibafajta.
      //
      // 1. KÖZVETLENÜL A CÍMKE ELŐTT, mértékegységgel. Ez a legszorosabb
      //    kötés, ezért ez megy elöl. A magyar ragozás miatt kell: a
      //    „max. 150 kg **teherbírással** és mindössze 8,8 kg súllyal"
      //    mondatban a címke után is áll szám — csak az már a KÖVETKEZŐ
      //    állítás értéke. A `-sal/-sel` rag épp azt jelenti, hogy az érték
      //    elöl van.
      //
      //    A minta szándékosan szoros: szám + mértékegység, közte csak
      //    nem-szám karakter. Enélkül a sor bármelyik száma bekerülhetne —
      //    egy „3 uszony, teherbírás" sorból 3 kg teherbírás lenne. A SOR
      //    elejénél megáll, tehát az előző mező értéke nem szivároghat át.
      //    KETTŐSPONT ESETÉN NEM ÉL: a `Capacity:` alak maga mondja ki, hogy
      //    az érték UTÁNA jön. Élesben (zraysports.com) az egy sorba írt
      //    `… Volume: 379L Capacity: up to 170 kg` sorban a címke előtt a
      //    SZOMSZÉD MEZŐ értéke (379L) áll — kettőspont nélkül azt vennénk.
      // MINŐSÍTŐ SZÓ A CÍMKE UTÁN: ilyenkor a szám MÁST mér.
      // Élesben (aquamarinahungary.com, BLADE Windsurf): „Súly vitorlával:
      // 20,5kg" — a vitorlával együtt mért tömeg NEM a deszka súlya (a deszka
      // maga ~10 kg). A `[ae]v[ae]l` szabály ezt nem fogja meg, mert az a
      // címkéhez TAPADT ragot nézi, itt viszont külön szó áll.
      if (excludeFollowedBy.length > 0) {
        const gap = folded.slice(index + needle.length, index + needle.length + 24);
        if (excludeFollowedBy.some((word) => gap.includes(foldText(word)))) continue;
      }

      // A TELJES SZÉLESSÉGŰ kettőspont (`：` U+FF1A) ugyanúgy azt mondja, hogy
      // az érték a címke UTÁN jön — enélkül a „címke ELŐTT" ág lépne életbe, és
      // a `Dimensions: 11'×30'×6' Capacity：280 Pounds` sorban a MÉRET utolsó
      // darabját (`6'`) venné teherbírásnak (funwaterboard.com).
      const hasColon = /^\s*[:：]/.test(after);
      const lineStart = folded.lastIndexOf("\n", index) + 1;
      const trailing = hasColon
        ? null
        : text
            .slice(lineStart, index)
            // Az érték és a címke között CSAK SZÓKÖZ állhat. Írásjel már
            // mezőhatárt jelöl: a „…15 cm, teherbírás max. 160 kg" sorban a
            // vessző előtti 15 cm a VASTAGSÁG, nem a teherbírás.
            //
            // AZ IMPERIÁLIS JELEK IS EGYSÉGEK (F2.1-utó-47). Élesben mért kár
            // (funwaterboard.com): a spec-tábla UTÁN álló reklámmondat így
            // szól — `The 10'6" length, 33" width, and 6" thickness make this
            // paddleboard versatile…`. Itt MINDHÁROM érték a címkéje ELŐTT
            // áll, csak láb- és hüvelyk-jellel. A metrikus-only minta ezt nem
            // fogta, ezért a „címke UTÁN" ág lépett életbe, és EGGYEL
            // ELCSÚSZOTT: a hosszba a szélesség (33″ = 83,8 cm), a
            // szélességbe a vastagság került — a spec-táblából helyesen
            // kiolvasott 320 cm-t felülírva. Csendes, hihetőnek látszó
            // adathiba, pont a Deszkaválasztó bemenetén.
            //
            // A LÁB-HÜVELYK ÖSSZETETT ALAK (`10'6"`) EGY érték, ezért áll az
            // egyszerű alak ELŐTT a váltakozásban: külön nézve a `6"`-ot
            // adná hossznak.
            .match(
              new RegExp(
                "(" +
                  // a) LÁB + HÜVELYK összetett alak — EGY érték (`10'6\"`,
                  //    `11\u20196\u201d`). Elöl áll: külön nézve a hüvelyk-részt adná.
                  "\\d+(?:[.,]\\d+)?\\s*['\u2032\u2019]\\s*\\d+(?:[.,]\\d+)?\\s*(?:''|\"|\u201d|\u2033)" +
                  // b) SZÓ-alakú egységek — itt kell a szóhatár
                  "|\\d+(?:[.,]\\d+)?\\s*(?:kg|lbs?|pounds?|l|liter|litre|cm|mm|m|inch(?:es)?|in|feet|foot|ft)\\b" +
                  // c) JEL-alakú egységek — a szóhatár itt értelmetlen lenne
                  "|\\d+(?:[.,]\\d+)?\\s*(?:''|\"|\u201d|\u2033|'|\u2032|\u2019)" +
                  ")" +
                  // A ZÁRÓJELES ÁTVÁLTÁS a érték és a címke KÖZÉ ékelődhet:
                  // `11'6\"(335cm) length 33\"(83cm) width` — a gyártó a saját
                  // metrikus megfelelőjét teszi zárójelbe. Enélkül a minta
                  // megszakad, és a „címke UTÁN" ág csúsztatja el a hármast.
                  "(?:\\s*\\([^)]*\\))?" +
                  // …és állhat közte ELÖLJÁRÓ is: `11 feet (335 cm) in length,
                  // 33 inches (84 cm) in width` (funwaterboard.com). Az „in"
                  // itt nem mértékegység, hanem kötőszó — a mértékegységet a
                  // fenti csoport már elnyelte.
                  "(?:\\s+(?:in|of))?[ \\t]*$",
                "i",
              ),
            );
      if (trailing?.[1] !== undefined) return trailing[1];

      const window = windowAfterLabel(text, index + label.length);
      // 2. AZONOS SOR, A CÍMKE UTÁN — a leggyakoribb alak („Teherbírás 150 kg").
      if (/\d/.test(window.split("\n")[0] ?? "")) return window;
      // 3. A KÖVETKEZŐ SOR — a kétoszlopos táblák alakja („MAX. PAYLOAD" és
      //    alatta „308 lbs / 140 kg"). Ez a legkockázatosabb (a szomszédos
      //    mező szivároghat be), ezért marad utolsónak.
      if (/\d/.test(window)) return window;
    }
  }
  return null;
}

/**
 * "325 x 82 x 16cm" VAGY "120 x 34 x 6 Inches" jellegű, EGY sorba írt
 * hossz×szélesség×vastagság minta — a boltok gyakran nem külön "Hosszúság"/
 * "Szélesség"/"Vastagság" címkével, hanem egyetlen "Dimensions:" sorral adják
 * meg, néha KIZÁRÓLAG hüvelykben (élesben mért eset: bluefinsupboards.eu
 * "Lite" termékvonala csak "Inches"-t ad, cm-et nem). `×` és `x` is
 * elfogadott, a szóköz a szám és az `x`/mértékegység között opcionális
 * (élesben látott: "82 x16cm").
 */
/**
 * A szorzójel karakterei. A CIRILL „х" (U+0445) SZÁNDÉKOSAN benne van: élesben
 * mérve (gladiatorsup.com) a méret-sor `354 х 86 х 15 cm` alakú, cirill x-szel
 * — latin `x`-re szűrve az egész sor láthatatlan marad. Vizuálisan
 * megkülönböztethetetlen, tehát a forrás oldalán ez nem is „hiba", amit
 * kijavítanának.
 */
// A `*` is szorzójel: élesben (funwaterboard.com) `10′6″ * 33″ * 6″`.
const TIMES_CHARS = "x×хХ*";

const TRIPLE_DIMENSION_RE = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*[${TIMES_CHARS}]\\s*(\\d+(?:[.,]\\d+)?)\\s*[${TIMES_CHARS}]\\s*(\\d+(?:[.,]\\d+)?)\\s*(cm|inch(?:es)?|in)\\b`,
  "gi",
);

function tripleFromMatch(
  match: RegExpMatchArray,
): { lengthCm: number; widthCm: number; thicknessCm: number } | null {
  const length = toNumber(match[1] ?? "");
  const width = toNumber(match[2] ?? "");
  const thickness = toNumber(match[3] ?? "");
  if (length === null || width === null || thickness === null) return null;
  const isInches = /^in/i.test(match[4] ?? "");
  const toCm = (v: number) => round1(isInches ? v * CM_PER_INCH : v);
  return {
    lengthCm: toCm(length),
    widthCm: toCm(width),
    thicknessCm: toCm(thickness),
  };
}

function parseTripleDimensionCm(
  text: string,
): { lengthCm: number; widthCm: number; thicknessCm: number } | null {
  // A méret-sorba ÉKELT zárójel magyarázat, nem érték — élesben
  // (gladiatorsup.com): `463 х 91 (36”) х 15 cm`, ahol a `(36”)` a szélesség
  // hüvelykben. Enélkül sem a záró-egységes minta, sem a darabonkénti parse
  // nem illeszkedik: a középső darab két számot viselne.
  //
  // DE a zárójel körül is állhat a TELJES hármas — `Mérete (366 x 84 x 15 cm)`
  // (aquamarinahungary.com) —, ezért az EREDETI szöveg megy előbb, és a
  // zárójel-mentes változat csak akkor jön, ha az nem illeszkedett.
  const variants = [text, text.replace(/\([^)]*\)/g, " ")];
  for (const variant of variants) {
    const match = variant.match(new RegExp(TRIPLE_DIMENSION_RE.source, "i"));
    if (match) return tripleFromMatch(match);
  }
  for (const variant of variants) {
    const triple = parseTripleByParts(variant);
    if (triple) return triple;
  }
  return null;
}

/**
 * Hármas méret ÉRTÉKENKÉNTI mértékegységgel — a `TRIPLE_DIMENSION_RE` egyetlen,
 * ZÁRÓ egységet vár, és ez élesben kevésnek bizonyult.
 *
 * MÉRT ESETEK (jobesports.com):
 *   `Dimensions: 8'6" x 28" x 4,75" | 2,59m x 71,12cm x 12cm`
 * Itt EGYIK fél sem illeszkedik a záró-egységes mintára: az imperiális részen
 * hüvelyk-jelek állnak (nem „inch" szó), a metrikus rész pedig KEVERT egységű
 * (m, cm, cm).
 *
 * A megoldás nem újabb regex, hanem a MEGLÉVŐ, jól bejáratott egy-értékes
 * `parseDimensionCm` használata darabonként: az már ismeri a láb-hüvelyk, a
 * hüvelyk-jel, a méter és a centiméter alakot is. Ha bármelyik darabból hiányzik
 * a mértékegység, `null` — puszta számból továbbra sem találgatunk.
 */
function parseTripleByParts(
  text: string,
): { lengthCm: number; widthCm: number; thicknessCm: number } | null {
  // A `|` UGYANAZT a méretet írja le kétféleképp („imperiális | metrikus") —
  // a két írásmódot tehát KÜLÖN kell nézni. Enélkül a harmadik darab
  // (`4,75" | 2,59m`) a MÁSIK írásmód HOSSZÁT adná vastagságként (259 cm).
  for (const segment of text.split("|")) {
    const parts = segment
      .split(new RegExp(`\\s*[${TIMES_CHARS}]\\s*`, "i"))
      // Egy ÉRTÉK nem lóghat át a következő sorra. Élesben
      // (funwaterboard.com) a méret két készletet ad egymás alatt:
      //   `10′6″ * 33″ * 6″ for Adults,` / `8′ * 30″ * 4″ for Youth`
      // A harmadik darab enélkül a MÁSODIK sor első értékét (`8′` = 244 cm)
      // olvasta volna vastagságnak a valós 6″ (15 cm) helyett.
      .map((part) => (part.trim().split("\n")[0] ?? "").trim());
    if (parts.length < 3) continue;
    const [length, width, thickness] = parts
      .slice(0, 3)
      .map((part) => parseDimensionCm(part));
    if (length === undefined || width === undefined || thickness === undefined)
      continue;
    if (length === null || width === null || thickness === null) continue;
    return { lengthCm: length, widthCm: width, thicknessCm: thickness };
  }
  return null;
}

/**
 * Mint `parseTripleDimensionCm`, de a TELJES szövegben keres (nem csak egy
 * címke utáni ablakban), ezért a találat POZÍCIÓJA előtti ~20 karaktert is
 * megnézi: ha ott kizáró szó áll (pl. "Bag Dimensions: 90 x 40 x20cm"), a
 * találatot átugorja és a KÖVETKEZŐ előfordulást keresi — ugyanaz a védelem,
 * mint a `valueAfterLabel` `excludePrecededBy`-ánál, csak találat-relatív.
 */
function findBareTripleDimension(
  text: string,
  excludePrecededBy: readonly string[],
): { lengthCm: number; widthCm: number; thicknessCm: number } | null {
  const folded = foldText(text);
  const re = new RegExp(TRIPLE_DIMENSION_RE.source, "gi");
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    const before = folded.slice(Math.max(0, index - 20), index);
    const excluded = excludePrecededBy.some((word) =>
      before.includes(foldText(word)),
    );
    if (excluded) continue;
    const triple = tripleFromMatch(match);
    if (triple !== null) return triple;
  }
  return null;
}

/**
 * "381 x 79 cm" jellegű, csak hossz×szélesség PÁR — élesben mért eset
 * (aquamarinahungary.com): néhány oldal a "méretei" címke alatt csak a
 * hosszt és szélességet adja együtt, a vastagságot KÜLÖN "deszka vastagság"
 * címkével — a `parseTripleDimensionCm` (3 szám kell) ilyenkor hallgat.
 * Csak akkor hívjuk, ha a triple-próbálkozás már hallgatott ugyanezen az
 * ablakon — a `parseSpecsFromText` sorrendje ezt garantálja.
 */
const PAIR_DIMENSION_RE = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*[${TIMES_CHARS}]\\s*(\\d+(?:[.,]\\d+)?)\\s*(cm|inch(?:es)?|in)\\b`,
  "i",
);

function parsePairDimensionCm(
  text: string,
): { lengthCm: number; widthCm: number } | null {
  const match = text.match(PAIR_DIMENSION_RE);
  if (!match) return null;
  const length = toNumber(match[1] ?? "");
  const width = toNumber(match[2] ?? "");
  if (length === null || width === null) return null;
  const isInches = /^in/i.test(match[3] ?? "");
  const toCm = (v: number) => round1(isInches ? v * CM_PER_INCH : v);
  return { lengthCm: toCm(length), widthCm: toCm(width) };
}

/**
 * Spec-táblázat (vagy termékleírás) → `BoardSpecs`. Csak címkézett értéket
 * fogadunk el; a súly/teherbírás kg-ban, a térfogat literben.
 */
export function parseSpecsFromText(text: string): BoardSpecs {
  const specs: BoardSpecs = { ...EMPTY_SPECS };

  // A LEGMEGBÍZHATÓBB ALAK MEGY ELŐBB: szerkesztett táblázat, ahol az egység a
  // címkében áll (`Hosszúság (cm)` ⏎ `305`). Ld. a függvény doc-kommentjét.
  fillDimensionsFromLabelledLines(text, specs);

  for (const key of ["lengthCm", "widthCm", "thicknessCm"] as const) {
    // A MÁR MEGTALÁLT ÉRTÉKET NEM ÍRJUK FELÜL (F2.1-utó-52). Ez a menet a
    // SZABAD SZÖVEGBEN keres, és a `specs[key] = parseDimensionCm(window)`
    // értékadás korábban akkor is lecsapott, ha a laza minta `null`-t vagy
    // egy elszállt számot adott — vagyis a szerkesztett táblázatból már
    // helyesen kiolvasott méretet rontotta el. Élesben (aqualing.hu) a
    // `Vastagság (cm) / 12` cellából így lett 12000.
    if (specs[key] !== null) continue;
    const window = valueAfterLabel(text, SPEC_LABELS[key], ["paddle"]);
    if (window !== null) specs[key] = parseDimensionCm(window);
  }

  // Ha a fenti KÜLÖN címkék nem adtak mindhárom méretet, próbáljuk az
  // ÖSSZEVONT "Dimensions: 325 x 82 x 16cm" formát — csak a hiányzó mezőket
  // töltjük ki belőle, a már megtalált (specifikusabb címkéjű) érték marad.
  if (
    specs.lengthCm === null ||
    specs.widthCm === null ||
    specs.thicknessCm === null
  ) {
    const dimensionsWindow = valueAfterLabel(text, DIMENSIONS_LABELS, [
      "bag",
      "package",
      "táska",
      "csomag",
      "szállítás",
      "shipping",
    ]);
    const triple =
      dimensionsWindow !== null
        ? parseTripleDimensionCm(dimensionsWindow)
        : null;
    if (triple !== null) {
      if (specs.lengthCm === null) specs.lengthCm = triple.lengthCm;
      if (specs.widthCm === null) specs.widthCm = triple.widthCm;
      if (specs.thicknessCm === null) specs.thicknessCm = triple.thicknessCm;
      // A HOSSZ NEM LEHET KISEBB A SZÉLESSÉGNÉL (F2.1-utó-47). Ha a
      // címke-alapú olvasás mégis ilyet adott, a SPEC-TÁBLA hármasa a
      // megbízhatóbb — a táblázat a gyártó szerkesztett adata, a próza nem.
      //
      // ÉLESBEN MÉRT (funwaterboard.com, Fishing Cetus): a leírásban `Its 12"
      // length provides stability` áll — a gyártó HÜVELYK-jelet írt LÁB
      // helyett. Ugyanezen az oldalon a saját spec-táblája helyesen
      // `12' × 34″ × 6″`. A prózából olvasott 30,5 cm-es „hossz" viszont
      // elnyomta a táblázatot, mert az csak a HIÁNYZÓ mezőket tölti. Egy
      // 30 cm hosszú, 86 cm széles deszka nem létezik: ez nem ízlés kérdése,
      // hanem geometriai lehetetlenség.
      if (specs.widthCm !== null && specs.lengthCm !== null && specs.lengthCm < specs.widthCm) {
        specs.lengthCm = triple.lengthCm;
      }
    } else if (
      specs.lengthCm === null &&
      specs.widthCm === null &&
      dimensionsWindow !== null
    ) {
      // A hármas nem illeszkedett (pl. "méretei: 381 x 79 cm" — csak PÁR, a
      // vastagság külön címkével jön) — próbáljuk a pár-mintát ugyanazon az
      // ablakon.
      const pair = parsePairDimensionCm(dimensionsWindow);
      if (pair !== null) {
        specs.lengthCm = pair.lengthCm;
        specs.widthCm = pair.widthCm;
      }
    }
  }

  // Utolsó fallback: CÍMKE NÉLKÜLI "366x84x15 cm" a szabad szövegben —
  // élesben mért eset (aquamarinahungary.com): a "Mérete" címke UTÁN álló
  // szám elgépelt "m" mértékegységet visel ("Mérete (366m x 84x 15m)"),
  // miközben a leírás korábbi mondatában a HELYES "cm" egységgel, címke
  // nélkül is szerepel ugyanez a hármas ("...Aqua Marina, 366x84x15 cm").
  // A minta ön-leíró (explicit cm/inch egység kell hozzá), ezért a teljes
  // szövegben keresve is alacsony a téves találat kockázata.
  if (
    specs.lengthCm === null ||
    specs.widthCm === null ||
    specs.thicknessCm === null
  ) {
    const bareTriple = findBareTripleDimension(text, [
      "bag",
      "package",
      "táska",
      "csomag",
      "szállítás",
      "shipping",
    ]);
    if (bareTriple !== null) {
      if (specs.lengthCm === null) specs.lengthCm = bareTriple.lengthCm;
      if (specs.widthCm === null) specs.widthCm = bareTriple.widthCm;
      if (specs.thicknessCm === null)
        specs.thicknessCm = bareTriple.thicknessCm;
    }
  }

  const volumeWindow = valueAfterLabel(text, SPEC_LABELS.volumeL);
  if (volumeWindow !== null) {
    const match = volumeWindow.match(
      // A lengyel „350 litrów" tő eltér (`litr…`) — a `l\b` nem fogja meg,
      // mert az `l` után betű áll.
      /(\d+(?:[.,]\d+)?)\s*(?:l\b|liter|litre|litr)/i,
    );
    specs.volumeL = match ? toNumber(match[1] ?? "") : null;
  }

  for (const key of ["weightKg", "maxLoadKg"] as const) {
    // A DESZKA SÚLYA a keresett érték — a tartozékokkal együtt mért tömeg nem
    // az. Élesben (aquamarinahungary.com, BLADE Windsurf): „Súly vitorlával:
    // 20,5kg", miközben a deszka maga ~10 kg. Egy ilyen érték a
    // katalógusban azt sugallná, hogy a deszka kétszer olyan nehéz.
    const window = valueAfterLabel(
      text,
      SPEC_LABELS[key],
      PACKAGE_QUALIFIERS,
      WEIGHT_QUALIFIERS,
    );
    if (window === null) continue;
    specs[key] = parseWeightKg(window);
  }

  // AJÁNLOTT EVEZŐS-SÚLY MAGYARUL — és MIÉRT ÜTI a „terhelhetőség" címkét
  // (F2.1-utó-50).
  //
  // Élesben (decathlon.hu) a gyártó KÉT terhelési számot közöl:
  //   „Max. 140 kg-ig ideális, hogy az irányíthatósága tökéletes maradjon."
  //   „Max. terhelhetőség, amíg a vízfelszínen marad: 335 kg"
  // A második NEM teherbírás, hanem ARKHIMÉDÉSZ: pontosan annyi kilogramm,
  // ahány liter a deszka térfogata (350 l → 350 kg, 335 l → 335 kg,
  // 245 l → 245 kg) — az a pont, ahol a deszka teljesen elmerül. A
  // Deszkaválasztó ezt 0,66-os szorzóval veti össze az evezős súlyával, tehát
  // a 350-es szám egy 231 kg-os evezősnek is zöld utat adna egy olyan
  // deszkán, amire a gyártó 140 kg-ot ír. Ez nem pontatlanság, hanem
  // biztonsági hiba.
  //
  // Az ajánlott evezős-súly ezért nyer. Ugyanaz a döntés, mint a Jobe
  // „Recommended rider weight"-jénél (2026-08-20) és a Red Paddle
  // „riders up to"-jánál: a gyártó saját, KONZERVATÍV korlátja.
  const riderWeight = recommendedRiderWeightKg(text);
  if (riderWeight !== null) specs.maxLoadKg = riderWeight;

  // UTOLSÓ MENET: címke a SAJÁT SORÁBAN, alatta PUSZTA SZÁM. Csak a még
  // üresen maradt mezőket tölti (ld. `fillFromLabelledLines`).
  fillFromLabelledLines(text, specs);

  specs.inflatable = detectInflatable(text);
  return specs;
}

/**
 * Minősítő szavak, amik a súly/teherbírás címke után állva MÁST mérnek: nem a
 * deszkát magát, hanem a deszkát plusz valamit. Élesben mért eset a
 * vitorlával együtt megadott tömeg (aquamarinahungary.com).
 */
/**
 * A CSOMAG adatai NEM a deszkáéi. Élesben (funwaterboard.com) egymás alatt
 * áll `Item Weight: 28 Pounds` és `Package Weight: 18.87 Kilograms` — utóbbi
 * a szállítási doboz, tartozékokkal együtt. Ugyanez a `Package Dimensions`.
 */
const PACKAGE_QUALIFIERS = [
  "package",
  "csomag",
  "shipping",
  "szallitas",
  "szállítás",
  // A TARTOZÉK TÖMEGE SEM A DESZKÁÉ (F2.1-utó-50, decathlon.hu). Ugyanabban a
  // blokkban áll: „Súly (csak a deszka): 8,4 kg", „Az evező súlya: 1,2 kg",
  // „A pumpa súlya: 1200 g". A puszta „súly" needle enélkül az EVEZŐ tömegét
  // adta a deszka súlyaként (1,1 kg egy 6,7 kg-os deszkára).
  //
  // CSAK A MAGYAR ALAKOK: az angol „paddle" kipróbálva ELRONTOTTA az Aqua
  // Marina Hungaryt, ahol a címke „paddleboard súlya: 11 kg" — ott a
  // „paddle" nem tartozék, hanem a DESZKA neve. A fixtúra-háló azonnal
  // megfogta; a mérés döntött, nem a szimmetria.
  "evező",
  "evezo",
  "pumpa",
];

/**
 * A gyártó által AJÁNLOTT EVEZŐS-SÚLY magyar idiómából, kilogrammban.
 *
 * A magyar „-ig" rag maga a felső korlát („140 kg-ig"), címkeszó nélkül. Két
 * alakban áll élesben (decathlon.hu):
 *   „Max. 140 kg-ig ideális, hogy az irányíthatósága tökéletes maradjon."
 *   „140 kg-ig tervezve, maximális teherbírása 350 kg."
 *
 * MIÉRT KELL A MEGERŐSÍTŐ SZÓ (`max.` elöl, vagy `ideális`/`tervez` utána):
 * a puszta „130 kg-ig" a KAPCSOLÓDÓ TERMÉKEK címeiben is ott áll ugyanezen az
 * oldalon („Felfújható SUP Deszka 10' Tartozékokkal, 130 kg-ig, Sárga"), és a
 * szövegben ELŐBB, mint a termék saját adata. Megerősítés nélkül a szomszéd
 * deszka korlátja kerülne be — pontosan az a hiba, amit a zraysports.com
 * „Related Products" blokkja is okozott.
 */
export function recommendedRiderWeightKg(text: string): number | null {
  const match =
    text.match(/max\.?\s*(\d+(?:[.,]\d+)?)\s*kg\s*-?\s*ig\b/i) ??
    text.match(/(\d+(?:[.,]\d+)?)\s*kg\s*-?\s*ig\s+(?:ideális|tervez)/i);
  return match ? toNumber(match[1] ?? "") : null;
}

const WEIGHT_QUALIFIERS = [
  "vitorlával",
  "vitorlaval",
  "with sail",
  "csomaggal",
  "with bag",
  "tartozékokkal",
  "komplett",
];

/** Felfújható vagy kemény deszka? Bizonytalanságnál null. */
export function detectInflatable(text: string): boolean | null {
  const folded = foldText(text);
  // A SZERKEZETI jelek is számítanak, nem csak a szó szerinti „inflatable":
  // a drop-stitch mag, a nagynyomású szelep és a PVC-réteg fizikai tény egy
  // felfújható deszkáról. Élesben mért eset (zraysports.com): a termékoldal
  // egyszer sem írja le, hogy „inflatable", de a technológia-blokkja
  // részletezi az „I-Drop Stitch Core"-t és a „High Pressure Valve"-ot.
  const inflatable = [
    "felfujhato",
    "inflatable",
    "isup",
    "i-sup",
    "pumpa",
    "drop stitch",
    "drop-stitch",
    "dropstitch",
    "high pressure valve",
  ].some((w) => folded.includes(w));
  const rigid = hasRigidClaim(folded);
  if (inflatable && !rigid) return true;
  if (rigid && !inflatable) return false;
  return null;
}

/**
 * Kemény deszkára utaló ÁLLÍTÁS — a HASONLATOT nem számítjuk annak.
 *
 * Élesben mért csapda (zraysports.com): egy felfújható deszka leírása szerint
 * „it makes rider feel just LIKE paddling on a hardboard". Ez épp az
 * ellenkezőjét mondja annak, amit a puszta szó-illesztés kiolvasna belőle —
 * ezért a „like"/„mint" előzményű előfordulás nem számít állításnak.
 */
function hasRigidClaim(folded: string): boolean {
  const words = ["kemeny deszka", "hardboard", "hard board", "rigid", "epoxy"];
  for (const word of words) {
    let from = 0;
    for (;;) {
      const index = folded.indexOf(word, from);
      if (index < 0) break;
      from = index + word.length;
      const before = folded.slice(Math.max(0, index - 30), index);
      if (!/\b(like|mint)\b/.test(before)) return true;
    }
  }
  return false;
}

/**
 * Deszkatípus kulcsszóból. A sorrend SPECIFIKUS → általános: a „kids touring"
 * gyerekdeszka, nem túradeszka. Nincs találat → null (a moderátor dönt).
 */
export function guessBoardType(text: string): BoardType | null {
  const folded = foldText(text);
  const rules: [BoardType, string[]][] = [
    ["kids", ["kids", "gyerek", "junior", "youth"]],
    ["fishing", ["fishing", "horgasz", "angler"]],
    // A „rapid" és a „wild river" a gyártói kategória-slugokban szerepel
    // (aquamarina.com/products/rapid/, .../wildriver/).
    ["river", ["river", "folyo", "whitewater", "vadviz", "rapid"]],
    ["race", ["race", "verseny", "racing"]],
    ["yoga", ["yoga", "joga", "fitness", "pilates"]],
    ["touring", ["touring", "tura", "explorer", "adventure"]],
    // Az „all-around" (két a-val) a gyártói írásmód — az aquamarina.com
    // kategóriája `/products/all-around/` és `/products/advanced-all-around/`.
    [
      "allround",
      [
        "allround",
        "all-round",
        "all round",
        "all-around",
        "all around",
        "univerzalis",
      ],
    ],
  ];
  for (const [type, needles] of rules) {
    if (needles.some((needle) => folded.includes(needle))) return type;
  }
  return null;
}

/**
 * Deszkatípus MARKETING-PRÓZÁBÓL — ugyanaz a szigor, mint az angol
 * `boardTypeFromDescription`-nél, de magyar szórenddel is (F2.1-utó-36).
 *
 * MIÉRT KÜLÖN A PRÓZA: a `guessBoardType` puszta kulcsszót keres, mert a
 * CÍMBEN és az URL-SLUGBAN a szó maga a besorolás (`/products/wildriver/`).
 * Prózában viszont ugyanaz a szó ÚTI CÉLT jelenthet. Élesben mért eset
 * (sup-deszka.hu, TooMuch TIDE): „EVA borítás, 3 uszony kezdőknek és
 * rekreációhoz – ideális tengerre, tóra vagy **folyóra**." Ebből a „folyo"
 * kulcsszó VADVÍZI deszkát csinált egy kezdő allround deszkából — pont a
 * legveszélyesebb irányba tévedve, hiszen a mondat épp azt mondja, hogy
 * HÁROMFÉLE vízre jó, tehát univerzális.
 *
 * A magyar itt fordított szórendű („túra deszka", „verseny SUP"), ezért a
 * főnév a kulcsszó UTÁN áll, és a ragozott alak (`folyó**ra**`, `tó**ra**`)
 * nem illeszkedik — a kategóriát jelentő alak `folyami`/`vadvízi`.
 */
export function boardTypesFromProse(text: string): BoardType[] {
  const folded = foldText(text);
  // A kategória-szó és a főnév közé JELZŐK ékelődhetnek („all-round
  // **inflatable** paddleboard"), ezért legfeljebb három szó átugorható —
  // KÖTŐSZÓ viszont nem. A kötőszó ugyanis SOROLÁST jelent („river **or** lake
  // board"), és a sorolt kategóriák egyike sem A kategória. Írásjel sem fér
  // bele: a szóközt szigorúan megköveteljük, így a „tóra, vagy folyóra"
  // vesszője megállítja a mintát.
  const gap = String.raw`(?:[ \t]+(?!or\b|and\b|vagy\b|es\b|vs\b)[a-z0-9-]+){0,3}`;
  const noun = String.raw`${gap}[ \t-]*(?:i?sup[ \t-]*)?(?:paddleboard|paddle board|deszka|board|model|szorf)`;
  const rules: [BoardType, string][] = [
    ["kids", String.raw`(?:gyerek|junior|kids|youth)`],
    ["fishing", String.raw`(?:horgasz|fishing|angler)`],
    ["river", String.raw`(?:folyami|vadvizi|river|whitewater)`],
    ["race", String.raw`(?:verseny|race|racing)`],
    ["yoga", String.raw`(?:joga|yoga|fitness|pilates)`],
    ["touring", String.raw`(?:tura|touring|explorer)`],
    ["allround", String.raw`(?:allround|all-round|all round|univerzalis)`],
  ];
  const found: BoardType[] = [];
  for (const [type, keyword] of rules) {
    if (new RegExp(`\\b${keyword}${noun}\\b`, "i").test(folded)) found.push(type);
  }
  return found;
}

/**
 * A prózából kiolvasott EGYETLEN kategória — akkor, ha a szöveg pontosan egyet
 * mond ki. Több találatnál `null`: az EGYÉRTÉKŰ ág nem dönthet a moderátor
 * helyett arról, melyik a „fő" — épp ez a korlát vezetett a halmaz-modellhez
 * (F2.1-utó-41).
 */
export function boardTypeFromProse(text: string): BoardType | null {
  const found = boardTypesFromProse(text);
  return found.length === 1 ? found[0]! : null;
}

/**
 * Kategorizált kiegészítő-kulcsszavak (F2.3 3. szakasz — a korábbi lapos
 * `ACCESSORY_KEYWORDS` lista helyett). SPECIFIKUS → ÁLTALÁNOS sorrend (mint a
 * `guessBoardType`): a „szárazzsák" előbb jön, mint a „táska", mert az előbbi
 * az utóbbi szűkebb esete, és a substring-illesztés a legelső találatot veszi.
 * Csak a `GEAR_CATEGORIES` (catalog modul, `gear.ts`) 8 kategóriáját fedi le.
 */
const ACCESSORY_CATEGORY_RULES: [GearCategory, string[]][] = [
  // A TÁSKA/TARTÓ előrébb van, mint az „evezo": az „evezőtáska" és az
  // „evezőtartó" a substring miatt evezőnek látszana, pedig az egyik táska,
  // a másik rögzítő — élesben mérve mindkettő megjelent a jelöltek közt.
  [
    "taska",
    ["evezotaska", "evezo taska", "paddle bag", "evezotarto", "evezo tarto"],
  ],
  ["szarazzsak", ["szarazzsak", "dry bag", "drybag"]],
  [
    "mentomelleny",
    ["mentomellen", "mellen", "life vest", "life jacket", "pfd"],
  ],
  ["uszony", ["uszony", "finbox", "fin box"]],
  ["poraz", ["poraz", "leash"]],
  ["pumpa", ["pumpa", "pump"]],
  // Bare "paddle" szándékosan hiányzik: az beleillene a "paddleboard"/"paddle
  // board" BOARD_NOUNS-szóba is — csak az egyértelmű "evező"/"paddle blade" számít.
  // Az „oars" viszont egyértelmű: evezőlapát, sosem deszka (élesben:
  // zraysports.com „ALUMINUM OARS"). A csupasz „oar" SZÁNDÉKOSAN hiányzik: a
  // „b-oar-d" részstringje lenne, tehát minden deszkára illeszkedne.
  ["evezo", ["evezo", "paddle blade", "oars"]],
  // A „gearbag" egybeírva is táska (fanatic.com: `fanatic-gearbag-pocket-isup`).
  [
    "taska",
    [
      "hatizsak",
      "taska",
      "backpack",
      "board bag",
      "carry bag",
      "gearbag",
      "gear bag",
    ],
  ],
  ["ules", ["ules", "kayak seat", "seat"]],
];

/**
 * Egyéb kiegészítő-jellegű szavak, amik EGYIK gear-kategóriának SEM felelnek
 * meg (ruházat, apró tartozékok, ajándékutalvány…) — ezek is kizárják a
 * deszka-besorolást, de nem termelnek jelöltet SEM (`ignore`, nem `accessory`).
 */
const MISC_NON_BOARD_KEYWORDS = [
  "napszemuveg",
  "szemuveg",
  "sunglass",
  "polo",
  "sapka",
  "kesztyu",
  "cipo",
  "neopren",
  "ruha",
  "wetsuit",
  "leggings",
  "cap ",
  "javito",
  "szelep",
  "valve",
  "repair",
  "kulacs",
  "szij",
  "strap",
  "kocsi",
  "allvany",
  "matrica",
  "ajandekutalvany",
  "utalvany",
  // Élesben mért esetek: a "board" szótő ruházati/alkatrész-termékekben is
  // előfordul (nem a BOARD_NOUNS-listás "board" főnévi jelentésben), ezért
  // ELŐBB kell kizárni, mint hogy a `hasBoardNoun` ág elérje.
  "boardshorts",
  "board shorts",
  "handle",
];

/**
 * SOSEM deszka — bármilyen méret és teherbírás mellett sem (F2.1-utó-17).
 *
 * Élesben mért hiba: az `aquamarina.com` gyártói katalógusából KAJAKOK
 * kerültek be deszka-jelöltként (Halve, Laxo, Memba, Betta, Steam, Tomahawk).
 * A `classifyProduct` első szabálya rövidre zár — „deszka-tartományú hossz +
 * teherbírás → deszka" —, márpedig egy kajak pontosan ilyen. Ezek ráadásul
 * UGYANAZOK a termékek, amiket 2026-08-17-én/18-án kézzel kellett elutasítani
 * a bolti forrásokból; a kulcsszavas kizárás ezt előzi meg.
 *
 * Ezért ez a lista MINDEN más szabály ELŐTT dönt.
 */
const NEVER_BOARD_KEYWORDS = [
  "kajak",
  "kayak",
  "kenu",
  "canoe",
  "csonak",
  "gumicsonak",
  // Gyűjtő-/kategórialap, nem termék („SUP Equipment").
  "equipment",
  "felszereles",
  // BODYBOARD: hason fekve használt hullámdeszka, nem SUP (élesben:
  // zraysports.com „Marine/Grain/Flower Bodyboard B1-B3", 122×71 cm). A
  // nevében ott a „board", ezért a deszka-főnév szabály átengedi — és a
  // méret-tartomány sem véd, mert a teherbírását kiírják. A szörf-kizárással
  // egy döntés alá esik (2026-08-19: „a surf egy teljesen más dolog").
  "bodyboard",
  "body board",
  // ÚSZÓ MATRAC ÉS PLATFORM (felhasználói döntés, 2026-08-22: „a matrac ne
  // maradjon, akárcsak a platform se"). Élesben: `VIGOUR AIRMAT` (249×89) és
  // `AirDock` (305×183). A méret-alapú rövidzár nem véd, mert a
  // teherbírásukat kiírják.
  //
  // A HATÁRVONAL AZ EVEZÉS, nem a testhelyzet: a SUP nevében is ott van, hogy
  // ÁLLVA használjuk (Stand Up Paddleboard), tehát az „állunk rajta" nem
  // különböztet meg semmit. Az számít, hogy EVEZŐVEL hajtjuk-e: a matracot és
  // a platformot nem, azok egy helyben úsznak. A jógadeszka (Dhyana, Peace)
  // ezért MARAD — azt evezik is.
  //
  // A WINDSURF-deszka ELLENBEN MARAD (ugyanaz a döntés): sík vízen az is SUP,
  // és a katalógusban már bent van ilyen (Fanatic Viper Air, a gyártó saját
  // felirata szerint `ALL-AROUND / WINDSURF`).
  //
  // A „platform" és a „dock" csak a CÍMBEN és az URL-ben számít, a leírásban
  // nem — különben minden „stable platform for yoga" mondat kiejtene egy
  // legitim deszkát.
  "airmat",
  "air mat",
  "matrac",
  "platform",
  "dock",
  // JÓGA-/TORNAMATRAC (funwaterboard.com, 2026-08-28): `Funwater Inflatable
  // Air Gymnastics Yoga Mat`, 243,8 × 91,4 cm, 149,7 kg teherbírással. Minden
  // szám hihető, ezért a gyanú-jelzés sem fogta meg — megjelöletlenül jutott
  // volna a moderátorhoz.
  //
  // A HATÁRVONAL VÁLTOZATLAN: nem a testhelyzet, hanem az EVEZÉS. A jóga
  // DESZKÁT (Aqua Marina Dhyana, Peace) evezik, ezért marad; a jóga MATRACOT
  // nem, az egy helyben úszik — ugyanaz a döntés, mint az `airmat`-nál.
  "yoga mat",
  "gymnastics",
  // GÖRDESZKA: a nevében ott a „board", tehát a deszka-főnév szabály
  // átengedi; eddig csak a hossz-tartomány fogta meg (71 cm).
  "skateboard",
  // BOLTI KIEGÉSZÍTŐK, amiknek a CÍMÉBEN ott a deszka mérete (red.equipment).
  // A `lengthFromTitle` szélesség-őrszeme a legtöbbjüket kiszűri, ezek viszont
  // a spec-blokkjukban is adnak szélességet — a nevük dönt.
  "backpack",
  "camera mount",
];

/** A deszka-mivolt pozitív jelei a névben/leírásban. */
const BOARD_NOUNS = [
  "deszka",
  "board",
  "isup",
  "i-sup",
  "paddleboard",
  "paddle board",
];

/** Deszkahossz ésszerű tartománya cm-ben — ez a spec-alapú, DÖNTŐ jel. */
const BOARD_LENGTH_MIN_CM = 240;
// 700 cm ≈ 23 láb: a gyártók többszemélyes „mega" deszkái (Aqua Marina MEGA
// 18'1"/550 cm, AIRSHIP RACE 22'0"/670 cm) is valódi SUP-ok, ezért a
// katalógusban a helyük. Hogy egyéni evezősnek NE ajánljuk őket, az advisor
// külön hossz-korláttal zárja ki (`singlePaddlerMaxLengthCm`) — felhasználói
// döntés, 2026-08-19.
const BOARD_LENGTH_MAX_CM = 700;

/**
 * Csak ezt a 3 kategóriát KÖVETJÜK jelöltként egyelőre (terv 3. szakasz,
 * „Mennyiségi korlát"): ne kövessünk minden 3000 Ft-os apróságot (póráz,
 * szárazzsák, ülés, uszony, táska felismerve is `ignore` marad). Bővíthető,
 * ha a moderációs tapasztalat úgy kívánja.
 */
export const TRACKED_ACCESSORY_TYPES: readonly GearCategory[] = [
  "evezo",
  "mentomelleny",
  "pumpa",
];

/** Kategorizált kiegészítő-egyezés a névben, specifikus→általános sorrendben. */
function guessAccessoryCategory(folded: string): GearCategory | null {
  for (const [category, needles] of ACCESSORY_CATEGORY_RULES) {
    if (needles.some((needle) => folded.includes(needle))) return category;
  }
  return null;
}

export type ProductClassification =
  | { kind: "board" }
  | { kind: "accessory"; accessoryType: GearCategory }
  | { kind: "ignore" };

/**
 * SUP-DESZKA, KÖVETETT FELSZERELÉS, vagy figyelmen kívül hagyandó termék?
 *
 * A figyelő minden termékoldalt lát, de a katalógus deszkákat ÉS a 3 érdemi
 * felszerelés-kategóriát (evező/mentőmellény/pumpa) gyűjti. A döntés
 * konzervatív minden irányban:
 *  * a mért spec (deszka-tartományba eső hossz + térfogat/teherbírás) MINDIG
 *    deszkát jelent — ez erősebb, mint bármelyik kulcsszó;
 *  * kategorizált kulcsszóra a KÖVETETT kategóriák jelöltet kapnak, a többi
 *    (póráz/szárazzsák/ülés/uszony/táska) felismerve is `ignore`;
 *  * az egyéb kiegészítő-jellegű szavak (ruházat, apróság) is `ignore`-t adnak;
 *  * kulcsszó-egyezés hiányában a régi deszka-heurisztika dönt.
 *
 * Ami így kiesik (`ignore`), az nem vész el végleg: a következő futás újra
 * megnézi, és a forrás `crawl_config`-jában a mintákkal is szűkíthető a kör.
 */
/**
 * A méretek ÖNMAGUKBAN ellentmondásmentesek-e? Egy deszka SOSEM szélesebb és
 * SOSEM vastagabb, mint amilyen hosszú.
 *
 * Két élesben mért hibát fog meg, mindkettő HAMIS adat volt, nem hiányzó:
 *  * `396,2 × 396,2 cm` — a kiegészítő-oldal a szomszéd deszka méretét szedte
 *    fel (zraysports.com),
 *  * `hossz 340,4 = vastagság 340,4` — a leírás prózájából olvasott két
 *    ugyanolyan számot (fanatic.com), miközben a valódi tábla csak
 *    böngésző-renderelés után létezik.
 *
 * Hiányzó mező nem ellentmondás: ott nincs mit összevetni.
 */
export function dimensionsAreCoherent(specs: BoardSpecs): boolean {
  const { lengthCm, widthCm, thicknessCm } = specs;
  if (lengthCm === null) return true;
  if (widthCm !== null && widthCm >= lengthCm) return false;
  if (thicknessCm !== null && thicknessCm >= lengthCm) return false;
  return true;
}

export function classifyProduct(product: {
  rawTitle: string;
  modelName: string;
  boardType: BoardType | null;
  specs: BoardSpecs;
  /**
   * További, TERMÉKSPECIFIKUS besorolási jel — például az URL útvonala
   * (`/products/reinforced-kayak/betta/`) vagy a bolt saját kategóriája.
   * SZÁNDÉKOSAN nem a teljes oldalszöveg: az a navigációt is tartalmazza,
   * ami minden oldalon ugyanaz (ld. az `extractProduct` doc-kommentjét).
   */
  classificationHint?: string;
}): ProductClassification {
  const { specs } = product;

  // ELSŐKÉNT: ami sosem deszka (kajak, kenu, gyűjtőlap) — a méret-alapú
  // rövidzár ELŐTT, különben egy kajak deszkaként jönne be.
  const identity = foldText(
    `${product.rawTitle} ${product.classificationHint ?? ""}`,
  );
  if (NEVER_BOARD_KEYWORDS.some((word) => identity.includes(word))) {
    return { kind: "ignore" };
  }

  const lengthInRange =
    specs.lengthCm !== null &&
    specs.lengthCm >= BOARD_LENGTH_MIN_CM &&
    specs.lengthCm <= BOARD_LENGTH_MAX_CM;
  // A méret-alapú rövidzár csak ÖNMAGÁBAN ELLENTMONDÁSMENTES adatra szólal
  // meg (`dimensionsAreCoherent`): egy deszka sosem szélesebb és sosem
  // vastagabb, mint amilyen hosszú.
  //
  // ÉLESBEN MÉRT HIBA (zraysports.com, 2026-08-20): a kiegészítő-oldalakon
  // (ALUMINUM OARS, Pump, LEASH, vízhatlan táska) nincs saját spec-blokk, a
  // „Related Products" viszont SUP-deszkákat sorol fel — a laza szöveg-parse
  // onnan szedte fel a méretet, és mindegyik kiegészítő „396,2 × 396,2 cm,
  // 150 kg teherbírás" DESZKAKÉNT jött volna be. A rövidzár szándékosan
  // erősebb minden kulcsszónál (egy rosszul címzett deszkát a saját adata
  // ment meg) — de csak akkor, ha az az adat egyáltalán deszkáé lehet.
  const dimensionsCoherent = dimensionsAreCoherent(specs);
  if (
    lengthInRange &&
    dimensionsCoherent &&
    (specs.volumeL !== null || specs.maxLoadKg !== null)
  ) {
    return { kind: "board" };
  }

  const folded = foldText(product.rawTitle);

  const accessoryType = guessAccessoryCategory(folded);
  if (accessoryType !== null) {
    return TRACKED_ACCESSORY_TYPES.includes(accessoryType)
      ? { kind: "accessory", accessoryType }
      : { kind: "ignore" };
  }

  if (MISC_NON_BOARD_KEYWORDS.some((word) => folded.includes(word))) {
    return { kind: "ignore" };
  }

  // A deszka-azonosításhoz a CÍM MELLETT a termékspecifikus jel (URL-útvonal,
  // bolti kategória) is számít — ugyanaz az `identity`, amit a „sosem deszka"
  // kizárás is használ. Élesben (fanatic.com): a gyerekdeszka címe a szlogen
  // levágása után csak „RIPPER AIR S | L | T", a mérete pedig 238 cm — a
  // küszöb alatt. Az URL viszont kimondja: `fanatic-ISUP-ripper-air-slt`.
  //
  // A KIEGÉSZÍTŐ-felismerés SZÁNDÉKOSAN marad a puszta címnél: az URL-ben álló
  // „paddle" (paddleboard) evezőnek minősítene egy deszkát.
  const hasBoardNoun = BOARD_NOUNS.some((noun) => identity.includes(noun));
  const hasSup = /\bi?sup\b/.test(identity);
  // A méret itt is csak ELLENTMONDÁSMENTESEN számít bizonyítéknak (ld. fent).
  const isBoard =
    hasBoardNoun ||
    (hasSup && product.boardType !== null) ||
    (lengthInRange && dimensionsCoherent);
  return isBoard ? { kind: "board" } : { kind: "ignore" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (isRecord(value)) {
    // schema.org Brand / ImageObject: a `name`, ill. `url` a hasznos mező.
    return firstString(value.name ?? value.url);
  }
  return null;
}

/**
 * Az `offers` alakjai: objektum, tömb, AggregateOffer (`lowPrice`), és a
 * WooCommerce/Rank Math által írt `priceSpecification` beágyazás — élesben mért
 * eset: az ár NEM az Offeren, hanem egy `PriceSpecification` gyerekben ül.
 */
function collectOffers(offers: unknown): Record<string, unknown>[] {
  const list: Record<string, unknown>[] = [];
  const stack: unknown[] = [offers];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    if (!isRecord(node)) continue;
    list.push(node);
    if (node.offers !== undefined) stack.push(node.offers);
    if (node.priceSpecification !== undefined)
      stack.push(node.priceSpecification);
  }
  return list;
}

/**
 * Ár-string → szám. A JSON-LD szabvány gépi alakot ír elő („189000"), de a
 * boltok sablonjai gyakran az EMBERI alakot teszik bele („429.000 Ft",
 * „429 000"). A naiv `Number()` ezeket 429-cé olvasná — ezért a
 * ezres-elválasztós alakokat külön ismerjük fel.
 */
export function parsePriceString(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,\s]/g, "").trim();
  if (cleaned === "") return null;

  // Magyar/EU ezres-elválasztó: 429.000 · 429 000 · 429.000,50
  if (/^\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?$/.test(cleaned)) {
    return toNumber(cleaned.replace(/[.\s]/g, "").replace(",", "."));
  }
  // Angolszász ezres-elválasztó: 429,000 · 429,000.50
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(cleaned)) {
    return toNumber(cleaned.replace(/,/g, ""));
  }
  return toNumber(cleaned);
}

/**
 * Ár forintban a JSON-LD `offers`-ből. Explicit NEM-HUF pénznem → null (nem
 * váltunk át: az árfolyam a figyelő dolgán kívül esik). Hiányzó pénznem
 * elfogadott, mert HU forrásokat nézünk — ezt a hívó forrás-szinten tudja.
 * Több ajánlatnál a LEGOLCSÓBB (a katalógus is így mutatja).
 */
export function parsePriceHuf(offers: unknown): number | null {
  let best: number | null = null;
  for (const offer of collectOffers(offers)) {
    const currency = firstString(offer.priceCurrency);
    if (currency !== null && currency.toUpperCase() !== "HUF") continue;

    const rawPrice = offer.price ?? offer.lowPrice ?? offer.highPrice;
    const price =
      typeof rawPrice === "number"
        ? rawPrice
        : typeof rawPrice === "string"
          ? parsePriceString(rawPrice)
          : null;
    if (price === null || price <= 0) continue;

    const rounded = Math.round(price);
    best = best === null ? rounded : Math.min(best, rounded);
  }
  return best;
}

/**
 * `availability` → van-e HU-elérhetőség. Ismeretlen → null.
 *
 * A szabvány schema.org-enumon túl a MAGYAR SZABAD SZÖVEGET is értjük (élesben
 * mért eset: `"availability": "Nincs raktáron"`). A tagadást ELŐBB vizsgáljuk,
 * mert a „nincs raktáron" tartalmazza a „raktáron"-t is — fordított sorrendben
 * pont az ellenkezőjét olvasnánk ki.
 */
const UNAVAILABLE_PATTERN =
  /(outofstock|soldout|discontinued|nincs raktaron|nincs keszleten|elfogyott|nem kaphato|nem rendelheto)/;
const AVAILABLE_PATTERN =
  /(instock|instoreonly|limitedavailability|preorder|backorder|raktaron|keszleten|azonnal)/;

export function parseAvailability(offers: unknown): boolean | null {
  let result: boolean | null = null;
  for (const offer of collectOffers(offers)) {
    const availability = firstString(offer.availability);
    if (availability === null) continue;
    const folded = foldText(availability);
    if (UNAVAILABLE_PATTERN.test(folded)) {
      result = false;
      continue;
    }
    // Egyetlen kapható ajánlat elég ahhoz, hogy a modell elérhető legyen.
    if (AVAILABLE_PATTERN.test(folded)) return true;
  }
  return result;
}

/**
 * JSON-LD Product node + termékoldal-szöveg → normalizált jelölt.
 *
 * A `pageText` (a termékoldal láthatóra tisztított szövege) opcionális: a
 * spec-táblázatok ritkán vannak a JSON-LD-ben, ezért a méreteket onnan
 * pótoljuk. A címből SOSEM következtetünk teherbírásra.
 *
 * A `defaultBrandName` (a forrás `crawl_config.defaultBrandName`-je) csak
 * akkor él, ha a JSON-LD sem `brand`-et, sem `manufacturer`-t nem ad — egy
 * saját gyártói boltnál ez gyakori, mert a bolt magától értetődőnek veszi a
 * márkát. A JSON-LD saját mezője mindig elsőbbséget élvez.
 */
export function extractProduct(
  node: Record<string, unknown>,
  sourceUrl: string,
  pageText = "",
  defaultBrandName: string | null = null,
): ExtractedProduct | null {
  const rawTitle = firstString(node.name)?.replace(/\s+/g, " ").trim() ?? "";
  if (rawTitle === "") return null;

  const brandName =
    normalizeBrandName(firstString(node.brand ?? node.manufacturer)) ??
    normalizeBrandName(defaultBrandName);
  const description = firstString(node.description) ?? "";
  const haystack = `${rawTitle}\n${description}\n${pageText}`;

  const specs = parseSpecsFromText(haystack);
  // A cím méret-jelölése (10'6") a legmegbízhatóbb hossz-forrás: a bolt a
  // konkrét variánst nevezi meg vele. Csak akkor él, ha a spec-táblázat hallgat.
  if (specs.lengthCm === null && /\d\s*'/.test(rawTitle)) {
    specs.lengthCm = parseDimensionCm(rawTitle);
  }

  const modelName = cleanModelName(rawTitle, brandName);
  // SZÁNDÉKOSAN NEM a teljes `haystack` (cím+leírás+oldalszöveg): élesben mért
  // hiba (aquamarinahungary.com) — a `pageText` a navigáció/kategória-menüt is
  // tartalmazza, ami MINDEN oldalon (ruházaton is) ott van, ha a bolt navja
  // "Touring"/"Race"/"Yoga" szót ír. Emiatt a `hasSup && boardType !== null`
  // besorolási ág gyakorlatilag bármit deszkának vett, ami "SUP"-ot említ. A
  // spec-parse (fent) ettől függetlenül a teljes szöveget nézi — az OTT talált
  // címkézett érték helyhez kötött, nem szennyeződik a menütől.
  // A CÍM és a LEÍRÁS KÜLÖN úton megy (F2.1-utó-36). A címben a kategória-szó
  // maga a besorolás, ezért ott a laza kulcsszó-lista jó; a leírás viszont
  // marketing-próza, ahol ugyanaz a szó úti célt jelenthet („ideális tengerre,
  // tóra vagy folyóra" → NEM vadvízi deszka). Ott ezért a főnevet is megkövetelő
  // szigorú minta fut.
  // A `boardTypeFromDescription` az angol „versatile/entry-level model" alakot
  // ismeri (a Gladiatorért készült), a `boardTypeFromProse` a magyar szórendet
  // és a ragozást — a kettő kiegészíti egymást, és mindkettő főnevet követel.
  const { boardType, boardTypeSource, boardTypes } = resolveBoardType({
    pinned: null,
    name: guessBoardType(rawTitle),
    category: null,
    breadcrumb: null,
    usage: null,
    description: boardTypeFromProse(description) ?? boardTypeFromDescription(description),
  });
  // A besorolás itt is lefut (nem csak a crawl.ts vezérlésében), hogy a
  // moderációs UI a kategória-legördülőt a figyelő tippjével előválaszthassa —
  // ugyanaz a minta, mint a `boardType` tippnél (a moderátor felülbírálhatja).
  const classification = classifyProduct({
    rawTitle,
    modelName,
    boardType,
    specs,
  });

  return {
    sourceUrl,
    brandName,
    modelName,
    rawTitle,
    // A KIÍRT évszám az elsődleges; ha nincs, az Aqua Marina cikkszáma
    // elárulja (`BT-23ATP` → 2023). A kereskedői oldalak az évet gyakran
    // sehol nem írják ki, a cikkszámot viszont igen.
    modelYear:
      extractModelYear(`${rawTitle} ${description}`) ??
      modelYearFromProductCode(`${rawTitle} ${description}`, brandName),
    priceHuf: parsePriceHuf(node.offers),
    inStock: parseAvailability(node.offers),
    imageUrl: displayImageUrl(firstString(node.image)),
    boardType,
    boardTypeSource,
    boardTypes,
    specs,
    accessoryType:
      classification.kind === "accessory" ? classification.accessoryType : null,
  };
}

/**
 * Az URL kategória-szegmensei szóközzel elválasztva — a gyártó SAJÁT
 * besorolása (`/products/advanced-all-around/coral/` → „products advanced
 * all around coral"). A `guessBoardType` ebből pontosabban tippel, mint a
 * puszta terméknévből.
 */
function urlCategoryHint(sourceUrl: string): string {
  try {
    return decodeURIComponent(new URL(sourceUrl).pathname).replace(
      /[-_/]+/g,
      " ",
    );
  } catch {
    return "";
  }
}

/**
 * „Transzponált" spec-blokk: ELŐBB az összes címke, UTÁNA az összes érték.
 *
 * Élesben mért (aquamarina.com/products/nuts/): a lap két hasábban közli a
 * specifikációt — az egyik `<div>` a címkéket sorolja fel, a másik az
 * értékeket —, ezért a szövegben így jelenik meg:
 *
 *   MODEL · PRODUCT · LENGTH · WIDTH · THICKNESS · VOLUME · NET WEIGHT …
 *   NUTS 10'6" · AM-20NU · 10'6" / 320cm · 32" / 81cm · 6" / 15cm · 300L …
 *
 * A szokásos „címke UTÁN 40 karakterrel" keresés ilyenkor a KÖVETKEZŐ CÍMKÉT
 * találja érték helyett, ezért mind a hat mező üresen maradna.
 *
 * BIZTONSÁGI FELTÉTELEK (különben pozíció-alapú találgatás lenne):
 *  - legalább 4 EGYMÁST KÖVETŐ sor legyen ismert spec-címke,
 *  - és pontosan ugyanannyi nem üres értéksor kövesse őket.
 * Ha bármelyik nem teljesül, `null` — marad a szokásos parse.
 */
/**
 * Egy cella értéke, ha az CSAK egy szám (legfeljebb „up to" előtaggal).
 * Táblázatban a mértékegység az oszlop fejében áll — máshol NEM használjuk.
 */

function bareNumber(value: string): number | null {
  const match = value
    .trim()
    .match(/^(?:up to|max\.?|~)?\s*(\d+(?:[.,]\d+)?)$/i);
  return match ? toNumber(match[1] ?? "") : null;
}

/**
 * Transzponált spec-tábla CÍMKÉI → mezők. A kulcsok normalizált alakban állnak
 * (kisbetű, egy szóköz, a mértékegység-utótag levágva).
 */
const TRANSPOSED_LABELS: Record<string, keyof BoardSpecs | "skip"> = {
  model: "skip",
  product: "skip",
  length: "lengthCm",
  width: "widthCm",
  thickness: "thicknessCm",
  volume: "volumeL",
  "net weight": "weightKg",
  "max. payload": "maxLoadKg",
  "max payload": "maxLoadKg",
  "max. air pressure": "skip",
  "max air pressure": "skip",
  // Fanatic (fanatic.com) „SIZES AND SPECS" táblája — a címkék MÉRTÉKEGYSÉG-
  // utótagot viselnek (`VOLUME (L)`, `WIDTH (IN / CM)`, `WEIGHT (KG) (+/-2%)`),
  // amit a normalizálás levág; a saját szavaik viszont kellenek ide.
  board: "skip",
  technology: "skip",
  fittings: "skip",
  "packing volume": "skip",
  "mastfoot insert": "skip",
  weight: "weightKg",
  "recommended user weight": "maxLoadKg",
  "rec. user weight": "maxLoadKg",
  "rec user weight": "maxLoadKg",
};

/**
 * Egy sor mint transzponált CÍMKE, vagy `undefined` ha nem az.
 * A zárójel itt is magyarázat: a `VOLUME (L)` és a `VOLUME` ugyanaz a mező.
 */
function transposedLabel(
  line: string,
): (keyof BoardSpecs | "skip") | undefined {
  const key = line
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return TRANSPOSED_LABELS[key];
}

/**
 * Egy címke-blokk + egy értékblokk → specifikáció. `null`, ha a hossz nem jött
 * ki: az a minimum, ami elárulja, hogy tényleg deszka-sort olvasunk.
 */
function specsFromBlock(
  labelLines: readonly string[],
  values: readonly string[],
  fullText: string,
): BoardSpecs | null {
  const specs: BoardSpecs = { ...EMPTY_SPECS };
  for (let k = 0; k < labelLines.length; k += 1) {
    const field = transposedLabel(labelLines[k] ?? "");
    const value = values[k] ?? "";
    if (field === "skip" || field === undefined) continue;
    switch (field) {
      case "lengthCm":
      case "widthCm":
      case "thicknessCm":
        specs[field] = parseDimensionCm(value);
        break;
      case "volumeL": {
        const match = value.match(/(\d+(?:[.,]\d+)?)\s*(?:l\b|liter|litre)/i);
        // Egység a CÍMKÉBEN: `VOLUME (L)` fölött a cella csak `355`
        // (fanatic.com). Táblázatban ez egyértelmű — az oszlop feje mondja
        // meg a mértékegységet, ahogy az olvasónak is.
        specs.volumeL = match ? toNumber(match[1] ?? "") : bareNumber(value);
        break;
      }
      case "weightKg":
      case "maxLoadKg": {
        // A `kg` ELSŐBBSÉGET élvez: a gyártó a fontot is kiírja
        // („20.1lbs / 9.1kg"), és ilyenkor a kilogramm nyer.
        const match = value.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
        specs[field] = match ? toNumber(match[1] ?? "") : bareNumber(value);
        break;
      }
    }
  }
  if (specs.lengthCm === null) return null;
  specs.inflatable = detectInflatable(fullText);
  return specs;
}

function parseTransposedSpecs(text: string): BoardSpecs | null {
  return parseTransposedSpecsBySize(text)[0]?.specs ?? null;
}

/**
 * MÉRETENKÉNTI bontás transzponált spec-táblából (F2.1-utó-35).
 *
 * Élesben (fanatic.com): EGY címke-blokk alatt EGYMÁS UTÁN több méret
 * értéksora áll —
 *
 *   BOARD | VOLUME (L) | LENGTH (IN / CM) | …
 *   FLY AIR S|L|T 9'8"  | 213 | 9'8'' / 294.6 | …
 *   FLY AIR S|L|T 10'4" | 284 | 10'4'' / 315  | …
 *
 * A SUP-nál a MÉRET maga a termék (a Deszkaválasztó hossz/szélesség alapján
 * pontoz), ezért itt is méretenként külön jelölt születik — ugyanaz az elv,
 * mint a Shopify-ág `expandShopifyProduct`-jánál.
 *
 * A blokk ELSŐ cellája a méret-címke (`FLY AIR S|L|T 9'8"`), ami a modellnevet
 * egészíti ki: enélkül öt azonos nevű „Fly Air" jelölt születne.
 */
export interface SizedSpecs {
  /** A méret-blokk első cellája — a modellnév kiegészítése. */
  label: string;
  specs: BoardSpecs;
}

export function parseTransposedSpecsBySize(text: string): SizedSpecs[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  for (let start = 0; start < lines.length; start += 1) {
    const labelCount = countKnownLabels(lines, start);
    if (labelCount < 4) continue;

    const out: SizedSpecs[] = [];
    for (
      let at = start + labelCount;
      at + labelCount <= lines.length;
      at += labelCount
    ) {
      const block = lines.slice(at, at + labelCount);
      // A blokk első cellája NÉV (nem szám) — enélkül már nem méret-sor,
      // hanem az oldal további tartalma.
      if (/^\d/.test(block[0] ?? "")) break;
      const specs = specsFromBlock(
        lines.slice(start, start + labelCount),
        block,
        text,
      );
      if (specs === null) break;
      out.push({ label: block[0] ?? "", specs });
    }
    if (out.length > 0) return out;
  }
  return [];
}

/** Hány EGYMÁST KÖVETŐ ismert címke áll `start`-tól? */
function countKnownLabels(lines: string[], start: number): number {
  let count = 0;
  while (
    start + count < lines.length &&
    transposedLabel(lines[start + count] ?? "") !== undefined
  ) {
    count += 1;
  }
  return count;
}

/**
 * A termék SAJÁT alcíme: a spec-blokkot közvetlenül megelőző rövid szövegablak.
 *
 * MIÉRT ÍGY: a gyártói oldalak a kategóriát a termék fölé írják — „LAXO
 * RECREATIONAL KAYAK", „RIPPLE RECREATIONAL CANOE", „BLAZE glowing series" —,
 * és ez az EGYETLEN megbízható per-termék jel. A teljes oldalszöveg
 * használhatatlan: a navigáció minden oldalon felsorolja a „Kayak" kategóriát
 * is, ezért élesben mérve a deszka-oldalakon (Blaze) is 31 „kayak" szó van.
 *
 * A szűk, 140 karakteres ablak a termék fejlécét fogja meg, a menüt már nem.
 */
function headlineBeforeSpecs(pageText: string): string {
  const anchor = pageText.search(
    /\b(PRODUCT|LENGTH|NET WEIGHT|MAX\.? PAYLOAD|Rider Weight)\b/,
  );
  if (anchor < 0) return "";
  return pageText.slice(Math.max(0, anchor - 140), anchor).replace(/\s+/g, " ");
}

/**
 * Termék kinyerése JSON-LD NÉLKÜLI oldalról (F2.1-utó-17, 2026-08-19).
 *
 * MIÉRT KELL: van gyártói oldal, amelyik nem tesz ki schema.org `Product`
 * JSON-LD-t, a specifikációt viszont CÍMKÉZETT SZÖVEGKÉNT közli, amit a
 * `parseSpecsFromText` amúgy is olvas. Élesben mért: `aquamarina.com` — a
 * termékoldalain 0 JSON-LD, de „NET WEIGHT / LENGTH / WIDTH / THICKNESS /
 * VOLUME / MAX. PAYLOAD" párokban ott a teljes adat.
 *
 * VÉDELEM A SZEMÉT ELLEN: csak akkor ad vissza terméket, ha a szövegből
 * KIJÖTT a hossz. Enélkül minden blogbejegyzés és kategóriaoldal jelöltté
 * válna (a sitemap ezeket is tartalmazza). A hossz megléte az a minimum,
 * ami elárulja, hogy tényleg egy deszka adatlapját nézzük.
 */
/**
 * Galéria-jelöltek a HTML-oldalról, KIZÁRÓLAG cikkszám-horgonnyal.
 *
 * A BORÍTÓ kimarad (azt az `image_url` viszi), a kizárt fájlnév-minták itt is
 * érvényesek, és a lista a `MAX_GALLERY_CANDIDATES`-nél elvágódik — ugyanaz a
 * szerződés, mint a Shopify-ágon (`galleryCandidates`).
 *
 * Cikkszám nélkül ÜRES a lista: pozícióra vagy modellnévre itt nem gyűjtünk,
 * mert a „Related Products" blokk más termékek fotóit is felkínálná.
 */
function galleryByCode(
  html: string,
  code: string | null,
  sourceUrl: string,
): string[] {
  if (code === null) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/gi)) {
    if (out.length >= MAX_GALLERY_CANDIDATES) break;
    const src = match[1] ?? "";
    const file = src.split("/").pop() ?? "";
    if (!file.includes(code)) continue;
    if (/logo|construction|technology|detail|icon|thumb|badge/i.test(file))
      continue;
    const url = displayImageUrl(absoluteUrl(src, sourceUrl));
    if (url === null || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  // Az ELSŐ találat lesz a borító (`findProductImage` ugyanezt választja) —
  // a galériában tehát nem ismételjük meg.
  return out.slice(1);
}

/**
 * A MORZSAMENÜ szövege — a bolt saját útvonala EHHEZ a termékhez.
 *
 * MIÉRT SZABAD EZT OLVASNI, amikor a teljes oldalszöveget SZÁNDÉKOSAN nem: a
 * navigációs menü MINDEN kategóriát felsorol minden oldalon, a morzsamenü
 * viszont pontosan egyet — azt, ahová ez a termék tartozik. Ez a gyártó saját
 * besorolása, ugyanolyan erős jel, mint az URL kategória-szegmense.
 *
 * ÉLESBEN MÉRT IGÉNY (zraysports.com): a termék-URL csak sorszám
 * (`/productinfo/854740.html`), a leírás nem mond kategóriát, a morzsamenü
 * viszont igen: `HOME › EVO COLLECTION › ALL AROUND EVO › Max Azure 11'6"`.
 * A Zray 76 deszka-jelöltjéből 62 maradt enélkül besorolatlanul.
 *
 * SZŰK ABLAK: a morzsamenü rövid, ezért csak az első pár száz karaktert
 * nézzük a konténer után — így a mögötte álló oldaltartalom (és a sablon
 * JS-kódja) nem szólhat bele.
 */
/**
 * Egy adott osztálynevű elem SZÖVEGE a HTML-ből. Szűk ablak: a keresett
 * felirat rövid, a mögötte álló oldaltartalom nem szólhat bele.
 */
function elementTextByClass(
  html: string,
  className: string | undefined,
): string {
  if (!className) return "";
  const match = html.match(
    new RegExp(`<[^>]*class="[^"]*${escapeRegExp(className)}[^"]*"[^>]*>`, "i"),
  );
  if (!match || match.index === undefined) return "";
  const from = match.index + match[0].length;
  return htmlToText(html.slice(from, from + 300))
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function breadcrumbText(html: string): string {
  const match = html.match(/<[^>]*(?:class|id|ctype)="[^"]*crumb[^"]*"[^>]*>/i);
  if (!match || match.index === undefined) return "";
  const after = html.slice(
    match.index + match[0].length,
    match.index + match[0].length + 1200,
  );
  return htmlToText(after).replace(/\s+/g, " ").slice(0, 200);
}

/**
 * A termék-URL végén álló CIKKSZÁM (legalább 6 számjegy az utolsó
 * útvonal-szegmensben). Élesben (jobesports.com):
 * `/en/jobe-aero-sava-sup-lite-board-86-package-486425010/` → `486425010`.
 *
 * Rövidebb számot SZÁNDÉKOSAN nem fogadunk el: a slugokban méret- és
 * évszámok is állnak (`…-board-86-`, `…-2026-`), azokra horgonyozni téves
 * képet adna.
 */
function codeFromUrl(sourceUrl: string): string | null {
  const last = sourceUrl.replace(/\/+$/, "").split("/").pop() ?? "";
  const match = last.match(/(\d{6,})(?!.*\d{6,})/);
  return match?.[1] ?? null;
}

/**
 * Kép-URL abszolutizálása a termékoldal URL-jéhez képest. Élesben mért eset
 * (zraysports.com): a `<img src>` PROTOKOLL-RELATÍV
 * (`//img.website.xin/…/3865618.png`) — így ahogy van, a katalógusból nem
 * tölthető be. Gyök- és útvonal-relatív alak is előfordul; a `URL`
 * konstruktor mindet elrendezi, érvénytelen bemenetre pedig inkább semmit
 * adunk, mint törött hivatkozást.
 */
function absoluteUrl(raw: string | null, baseUrl: string): string | null {
  if (raw === null || raw.trim() === "") return null;
  try {
    // ENTITÁS-DEKÓDOLÁS: a `src` attribútumban a query-elválasztó `&amp;`
    // alakban áll. Élesben (fanatic.com) enélkül a paraméter neve
    // `amp;height` lett, és a kiszolgáló a rossz méretet adta vissza.
    return new URL(decodeEntities(raw), baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * A MÓDSZER-POLC példányosítva a `normalize.ts` saját függvényeivel
 * (F2.1-utó-45). A körkörös import elkerülésére a `methods/catalog.ts` NEM
 * importál innen — a szükséges függvényeket beadjuk neki.
 */
/**
 * A GYÁRTÓ SAJÁT HASZNÁLAT-MEZŐJE a spec-táblából (F2.1-utó-47).
 *
 * ÉLESBEN MÉRT (funwaterboard.com): a spec-rács utolsó sorai közt ott áll
 *   `Versatility` / `All-around, ideal for cruising, exploring, and yoga`
 * — a gyártó KIMONDJA a besorolást, csak nem a névben és nem az URL-ben. A
 * névre hagyatkozva ez a deszka „touring" lett („Island Explorer"), holott a
 * gyártó all-roundnak ÍRJA. Ez a legerősebb elérhető jel ezen a forráson:
 * címkézett mező, nem következtetés.
 *
 * Kétféle alakot fogad, mindkettő spec-tábla: a címke a SAJÁT SORÁBAN (az
 * érték a következőben), vagy kettősponttal ugyanabban a sorban. A címke
 * PONTOS egyezés — a szabad szövegben előforduló „use"/„best for" fordulat
 * így nem minősül mezőnek.
 */
const USE_FIELD_LABELS = [
  "versatility",
  // Red Paddle (red.equipment): `Rider Style: All Round`. A gyártó saját
  // besorolása — a modellnévből tippelés itt téveszt („Voyager", „Compact"
  // nem használati kategória).
  "rider style",
  "riding style",
  "best for",
  "recommended use",
  "intended use",
  "board type",
  "hasznalat",
  "ajanlott hasznalat",
  // „Típus: All-around/Általános" (aqualing.hu) — a bolt saját besorolása az
  // attribútum-táblában. A szó általános, de a KOCKÁZAT alacsony: az értéket
  // utána még fel kell ismerni kategóriaként, tehát egy „Típus: felfújható"
  // mező semmit nem ír be.
  "tipus",
  // Lengyel: `Typ deski` ⏎ `Touring` (u1.net.pl).
  "typ deski",
];

export function labelledUseText(text: string): string {
  const lines = text.split("\n").map((line) => line.trim());

  // ELSŐ MENET — `Versatility: All-around, …`, címke és érték EGY sorban.
  //
  // MIÉRT ELŐBB (F2.1-utó-53, u1.net.pl): a termékoldalak SZŰRŐ-OLDALSÁVJA
  // ugyanazokat a címkéket viseli, mint a spec-tábla, és felsorolja az ÖSSZES
  // lehetséges értéket — `Typ deski` ⏎ `Deski SUP – Allround` ⏎
  // `Deski SUP – Gigant` ⏎ `Deski SUP – Race` … —, ráadásul ELŐBB, mint a
  // termék saját adata. A sorrendben haladó olvasó ezért a szűrő ELSŐ
  // opcióját adta kategóriának: minden deszka „allround" lett, a valódi
  // `Typ deski: Touring` helyett.
  //
  // A kettőspontos alakot viszont csak a spec írja; a szűrő nem. Ugyanaz az
  // elv, mint a `valueAfterLabel` kétmenetes keresésénél.
  for (const line of lines) {
    const folded = foldText(line);
    for (const label of USE_FIELD_LABELS) {
      const inline = folded.match(new RegExp(`^${label}\\s*[:：]\\s*(.+)$`));
      if (inline) return line.slice(line.length - (inline[1] ?? "").length);
    }
  }

  // MÁSODIK MENET — `Versatility` ⏎ `All-around, …`, a címke egyedül áll egy
  // sorban. Ez a laza alak; a kettőspontos mindig üti.
  for (let i = 0; i < lines.length; i += 1) {
    const folded = foldText(lines[i] ?? "");
    if (USE_FIELD_LABELS.includes(folded.replace(/\s*[:：]$/, ""))) {
      const value = valueLineAfter(lines, i);
      // Az érték legyen érdemi szöveg, ne a következő címke.
      if (value !== "" && value.length <= 160) return value;
    }
  }
  return "";
}

const CATEGORY_METHODS = buildCategoryMethods({
  guessBoardType,
  breadcrumbText,
  elementTextByClass,
  urlCategoryHint,
  multiUseFromProse,
  matchPinnedType,
  labelledUseText,
});

/**
 * A recept által KÉRT módszerek, a kért sorrendben — lista hiányában MIND, a
 * katalógus sorrendjében.
 *
 * MIÉRT EZ AZ ALAPÉRTELMEZÉS: így a bevezetés viselkedés-őrző. Amíg egy forrás
 * receptjébe nem írunk listát, pontosan a mai lánc fut le rá, és ezt a
 * fixtúra-háló bizonyítja. A szűkítés forrásonként, MÉRÉS után történik
 * (`probe-methods`).
 */
export function selectCategoryMethods(names?: readonly string[]): CategoryMethod[] {
  if (!names || names.length === 0) return CATEGORY_METHODS;
  const byName = new Map(CATEGORY_METHODS.map((method) => [method.name, method]));
  return names.flatMap((name) => {
    const method = byName.get(name);
    return method ? [method] : [];
  });
}

/** A teljes katalógus — a `probe-methods` végigpróbáláshoz. */
export function allCategoryMethods(): CategoryMethod[] {
  return CATEGORY_METHODS;
}

/**
 * A KÉRT MÓDSZEREK lefuttatása, sorrendben (F2.1-utó-45).
 *
 * MINDEN módszer eredménye megmarad — a halmaz-modell óta a többes találat nem
 * kétértelműség, hanem a válasz. A SORREND viszont számít: az első módszer
 * első találata kerül a `boardType` mezőbe (és a `board_type` oszlopba),
 * tehát a recept sorrendje = a megbízhatóság sorrendje.
 *
 * Ez váltja ki a korábbi, mindenkire egyformán lefutó `resolveBoardType`
 * láncot: ott a módszerek NEVE elveszett, és egy forrásnál hasznos szabály
 * (a prózás olvasó a Jobe-nál) máshol tévedett (a Fanaticnál).
 */
function runCategoryMethods(
  methods: readonly CategoryMethod[],
  ctx: MethodContext,
): {
  boardType: BoardType | null;
  boardTypeSource: string | null;
  boardTypes: { type: BoardType; source: string }[];
} {
  const boardTypes: { type: BoardType; source: string }[] = [];
  const seen = new Set<BoardType>();
  for (const method of methods) {
    for (const type of method.run(ctx).types) {
      if (seen.has(type)) continue;
      seen.add(type);
      boardTypes.push({ type, source: method.name });
    }
  }
  const first = boardTypes[0];
  return {
    boardType: first?.type ?? null,
    boardTypeSource: first?.source ?? null,
    boardTypes,
  };
}

/**
 * A KATEGÓRIA FORRÁSA — a moderátornak szól (felhasználói kérés, 2026-08-21).
 *
 * MIÉRT KELL: a moderációs felület eddig csak a VÉGEREDMÉNYT mutatta, azt is
 * úgy, hogy hiányzó kategória esetén némán „allround"-ot választott. Így a
 * moderátornak MINDEN modellt le kellett ellenőriznie a neten — nem tudta
 * megkülönböztetni a gyártó saját besorolását a névből tippelt találgatástól.
 *
 * A sorrend ITT a megbízhatóság sorrendje is: a `pinned` moderátori/taxonómia
 * döntés, a `category` és a `breadcrumb` a gyártó SAJÁT besorolása, a `name`
 * és a `description` viszont következtetés.
 */
export type BoardTypeSource =
  | "pinned"
  | "name"
  | "category"
  | "breadcrumb"
  | "usage"
  | "description";

/**
 * A kategória-lánc kiértékelése ÚGY, hogy az is megmaradjon, MELYIK lépés
 * adta. Az elsőbbségi sorrend változatlan — csak eddig elveszett az információ,
 * hogy honnan jött.
 */
function resolveBoardType(
  candidates: Record<BoardTypeSource, BoardType | BoardType[] | null>,
): {
  boardType: BoardType | null;
  boardTypeSource: BoardTypeSource | null;
  boardTypes: { type: BoardType; source: BoardTypeSource }[];
} {
  const order: BoardTypeSource[] = [
    "pinned",
    "name",
    "category",
    "breadcrumb",
    "usage",
    "description",
  ];

  // MINDEN forrás találata megmarad, nem csak az elsőé (F2.1-utó-41). A
  // gyártók okkal sorolnak egy deszkát több kategóriába — öt forráson mérve —,
  // és eddig épp az veszett el, amit kimondtak: a Fanatic
  // `TOURING / FREERACING` feliratának a második fele, a Starboard második
  // kollekciója, a Jobe „all-around AND touring" mondatának egyik tagja.
  //
  // A SORREND MEGMARAD: a `boardTypes` első eleme ugyanaz, ami korábban az
  // egyetlen `boardType` volt, és a `board_type` oszlop is ezt kapja. Így a
  // Deszkaválasztó és a katalógus-lista lépésenként állhat át.
  const boardTypes: { type: BoardType; source: BoardTypeSource }[] = [];
  const seen = new Set<BoardType>();
  for (const source of order) {
    const value = candidates[source];
    if (value === null) continue;
    // EGY FORRÁS TÖBBET IS ADHAT: a gyártó kategória-felirata gyakran kettős
    // (`TOURING / FREERACING`), és a Shopify-termék több kollekcióban is
    // szerepelhet. A felirat/kollekció SAJÁT sorrendje marad érvényben.
    for (const type of Array.isArray(value) ? value : [value]) {
      if (seen.has(type)) continue;
      seen.add(type);
      boardTypes.push({ type, source });
    }
  }

  const first = boardTypes[0];
  return {
    boardType: first?.type ?? null,
    boardTypeSource: first?.source ?? null,
    boardTypes,
  };
}

/** A rögzítés legalább ennyi karakter legyen, hogy a záró-illesztés ne tévedjen. */
const MIN_PIN_SLUG_LENGTH = 6;

/**
 * MODERÁTORI RÖGZÍTÉS illesztése az URL-re (`crawl_config.boardTypeByUrl`).
 *
 * Elsőként a régi, egyszerű részstring-egyezés — ez viszi az esetek zömét.
 *
 * ALIAS-URL-EK: van forrás, ami UGYANAZT a terméket két címen szolgálja ki,
 * márkanév-előtaggal és anélkül. Élesben mérve (gladiatorsup.com): a
 * rögzítések a kanonikus `/catalog/elite-11-6/` alakra készültek (a gyártó
 * kategória-oldalairól), a jelöltek egy része viszont
 * `/catalog/gladiator-elite-11-6/` címen érkezett — és ott a moderátori döntés
 * NEM érvényesült, pedig ugyanarról a deszkáról van szó. 8 jelölt.
 *
 * A záró-illesztés KÖTŐJEL-HATÁRON megy és minimális hosszt követel, hogy egy
 * rövid rögzítés ne fogjon meg idegen terméket (`pro-11-6` és `elite-11-6`
 * nem téveszthető össze).
 */
function matchPinnedType(
  sourceUrl: string,
  boardTypeByUrl: Readonly<Record<string, BoardType>>,
): BoardType | null {
  const entries = Object.entries(boardTypeByUrl);
  const direct = entries.find(([needle]) => sourceUrl.includes(needle));
  if (direct) return direct[1];

  const urlSlug = normalizePinSlug(sourceUrl);
  if (urlSlug === "") return null;

  const alias = entries.find(([needle]) => {
    const pinSlug = normalizePinSlug(needle);
    if (pinSlug.length < MIN_PIN_SLUG_LENGTH) return false;
    return urlSlug === pinSlug || urlSlug.endsWith(pinSlug);
  });
  return alias?.[1] ?? null;
}

/**
 * URL → összehasonlítható modell-szlug.
 *
 * Három zajforrást tüntet el, mind élesben mérve (gladiatorsup.com):
 *
 *  * CSOMAG-VÁLTOZAT: `…-elite-12-6t-without-a-paddle`. Az evező a csomag
 *    tartozéka — a DESZKA besorolása ettől nem változik (felhasználói
 *    észrevétel, 2026-08-22). 6 jelöltet érintett.
 *  * ÉVJÁRAT-UTÓTAG: `…-elite-14-0gt-2026`.
 *  * ELVÁLASZTÁS: a rögzítés `elite-12-6-s`, a jelölt URL-je `elite-12-6s`.
 *    Ugyanaz a modell, kétféle írásmóddal — ezért esik ki minden kötőjel.
 *
 * A márkanév-előtagot (`gladiator-…`) a hívó záró-illesztése kezeli.
 */
function normalizePinSlug(value: string): string {
  const segment = value.split("?")[0]!.split("/").filter(Boolean).pop() ?? "";
  return segment
    .toLowerCase()
    .replace(/-(?:with|without)-a-paddle$/, "")
    .replace(/-20\d{2}$/, "")
    .replace(/-/g, "");
}

export interface PageExtractionOptions {
  /**
   * A KATEGÓRIA-MÓDSZEREK neve, a kért sorrendben
   * (`crawl_config.categoryMethods`). Hiányában MIND fut, a katalógus
   * sorrendjében — így egy recept bővítése nem változtat a viselkedésen,
   * amíg listát nem ír bele.
   */
  categoryMethods?: readonly string[];
  /**
   * Kézi kategória-rögzítés (`crawl_config.boardTypeByUrl`): URL-részlet →
   * típus. Ez ÜT minden automatikus tippen, mert moderátori döntés.
   */
  boardTypeByUrl?: Readonly<Record<string, BoardType>>;
  /**
   * A `<title>`-ből levágandó, OLDAL-SZINTŰ utótagok
   * (`crawl_config.titleSuffixes`). Élesben mért eset (zraysports.com): minden
   * cím „-Zray Official Site"-tal végződik, amitől a modellnév „Max Azure M2 A
   * Official Site" lenne. Ez forrásonként más, ezért konfig — nem globális
   * zajszó-lista, ami egy jogos modellnevet is elvághatna.
   */
  titleSuffixes?: readonly string[];
  /**
   * A címet ENNÉL A JELNÉL vágjuk el (`crawl_config.titleCutAfter`) — a
   * mögötte álló szlogen termékenként más, ezért pontos utótagként nem adható
   * meg.
   */
  titleCutAfter?: readonly string[];
  /** Forrás-szintű zajszavak a modellnévből (`crawl_config.titleNoiseWords`). */
  titleNoiseWords?: readonly string[];
  /** A méret a modellnév része marad (`crawl_config.titleKeepSize`). */
  titleKeepSize?: boolean;
  /** A hossz a cím elejéről, ha egyetlen mező sem adja (`lengthFromTitle`). */
  lengthFromTitle?: boolean;
  /**
   * A MODELLNÉV A JSON-LD-BŐL, a `<title>` helyett
   * (`crawl_config.modelNameFromJsonLd`).
   *
   * Élesben (boteboard.com, 2026-08-29): a `<title>` SEO-mondat, ami
   * termékenként MÁS sablont követ, és az EasyRider Aeróé a modellnevet ki sem
   * mondja („Beginner Inflatable Paddle Board — SUP & Kayak | BOTE"). A
   * `LowRider Aero Tandem`-é pedig a „Kayak" szót viseli, amitől a
   * `classifyProduct` kajaknak nézte és eldobta a deszkát. Ugyanezeken az
   * oldalakon a `Product` JSON-LD `name`-je pontosan a katalógusnév
   * („EasyRider Aero", „LowRider Aero Tandem").
   *
   * MIÉRT OPT-IN, és miért nem az egész JSON-LD-ág: a spec ezeknél a
   * forrásoknál a SZÖVEGBEN van (`htmlOnly`), a JSON-LD egyetlen méretet sem
   * ad — csak a NEVET vesszük át belőle. Ahol a `<title>` a jobb (a legtöbb
   * forrásnál a JSON-LD neve a variánsnevet is viseli), ott a kapcsoló nélkül
   * minden változatlan.
   */
  modelNameFromJsonLd?: boolean;
  /**
   * A gyártó SAJÁT kategória-feliratát viselő elem osztályneve
   * (`crawl_config.categoryClass`). Termékspecifikus jel, ezért erős.
   */
  categoryClass?: string;
  /**
   * A spec-parse-hoz használandó szöveg, a HTML-ből kinyert helyett. A
   * BÖNGÉSZŐ-RENDERELT szöveg érkezik így (`render.ts`): a cím és a képek
   * továbbra is a HTML-ből jönnek, a specifikáció viszont abból a szövegből,
   * amit a felhasználó ténylegesen LÁT.
   *
   * Miért kell: élesben (fanatic.com) a „SIZES AND SPECS" tábla csak JS után,
   * görgetésre kerül a DOM-ba — a nyers HTML-ben egyetlen mérete sincs ott.
   */
  overrideText?: string;
}

/**
 * Hány karaktert vág le a cím végéről egy ismert utótag — 0, ha nem illik rá.
 *
 * A TELJES utótag a szokásos eset; a rövidebb darab a CSONKÍTOTT címeké
 * (`titleSuffixes` doc-komment). Mindig a leghosszabb illeszkedő darabot adja,
 * és 4 karakternél rövidebbet nem fogad el.
 */
function matchedSuffixLength(foldedTitle: string, foldedSuffix: string): number {
  if (foldedTitle.endsWith(foldedSuffix)) return foldedSuffix.length;
  for (let length = foldedSuffix.length - 1; length >= 4; length -= 1) {
    if (foldedTitle.endsWith(foldedSuffix.slice(0, length))) return length;
  }
  return 0;
}

export function extractProductFromPage(
  html: string,
  sourceUrl: string,
  defaultBrandName: string | null = null,
  options: PageExtractionOptions = {},
): ExtractedProduct | null {
  const {
    boardTypeByUrl = {},
    titleSuffixes = [],
    titleCutAfter = [],
    titleNoiseWords = [],
    titleKeepSize = false,
    lengthFromTitle = false,
    modelNameFromJsonLd = false,
    categoryClass,
    categoryMethods,
    overrideText,
  } = options;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let rawTitle = htmlToText(titleMatch?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  // A NÉV A JSON-LD-BŐL, ha a recept kéri (`modelNameFromJsonLd`). A
  // `<title>` ilyenkor SEO-mondat, a JSON-LD `name` viszont a katalógusnév —
  // ld. az opció doc-kommentjét. Csak akkor él, ha tényleg van neve: üres
  // találatnál marad a cím.
  if (modelNameFromJsonLd) {
    const node = pickPrimaryProduct(findProductNodes(html));
    const name = typeof node?.name === "string" ? node.name.trim() : "";
    if (name !== "") rawTitle = decodeEntities(name).replace(/\s+/g, " ").trim();
  }
  for (const marker of titleCutAfter) {
    const at = rawTitle.indexOf(marker);
    if (at <= 0) continue;
    // A MÁRKANÉV-ELŐTAG nem a modell, hanem fejléc — a jel MÖGÖTTI rész kell
    // (F2.1-utó-47). Élesben (funwaterboard.com) ugyanaz a jel kétféle
    // szerepben áll ugyanazon az oldalon:
    //   „Island Explorer 11' Inflatable Paddle Board | SUP for All Skill Levels"
    //      → a jel UTÁN reklámszöveg, a modell előtte van;
    //   „Funwater | Paddle Board Inflatable Sale Monkey 11' Touring"
    //      → a jel ELŐTT a márka, a modell utána van.
    // Vak vágással a második alakból „Funwater" lenne a modellnév. A
    // megkülönböztetés nem heurisztika: ha az elülső darab a márkanévnél
    // nem más, akkor az fejléc.
    const head = rawTitle.slice(0, at).trim();
    const tail = rawTitle.slice(at + marker.length).trim();
    const brandOnly =
      defaultBrandName !== null &&
      foldText(head) === foldText(defaultBrandName) &&
      tail !== "";
    rawTitle = brandOnly ? tail : head;
  }
  for (const suffix of titleSuffixes) {
    const folded = foldText(rawTitle);
    const needle = foldText(suffix);
    // A CSONKÍTOTT UTÓTAG IS UTÓTAG (F2.1-utó-52, aqualing.hu). A bolt fix
    // hosszra vágja a saját `<title>`-ét, ezért a végén az utótagnak csak egy
    // DARABJA marad: „… 305 x 84 x 12 cm - a" és „… 274x76x12 cm - aquali".
    // Ezek nem a modellnév részei, de pontos utótagként nem adhatók meg —
    // termékenként más hosszan csonkolódnak. A leghosszabb olyan darabot
    // vágjuk le, ami az utótag ELEJE; a 4 karakteres alsó korlát védi ki, hogy
    // egyetlen betű vagy szóköz miatt vágjunk.
    const cut = needle === "" ? 0 : matchedSuffixLength(folded, needle);
    if (cut > 0) {
      rawTitle = rawTitle
        .slice(0, rawTitle.length - cut)
        .replace(/[\s|·–—-]+$/, "");
    }
  }
  if (rawTitle === "") return null;

  const pageText = overrideText ?? htmlToText(html);
  // Elsőként a szokásos, címke-melletti parse; ha az üres, a két hasábos
  // („transzponált") elrendezés fallbackje.
  let specs = parseSpecsFromText(pageText);
  if (specs.lengthCm === null) {
    specs = parseTransposedSpecs(pageText) ?? specs;
  }
  // UTOLSÓ MENEDÉK: a HOSSZ A CÍMBŐL (`crawl_config.lengthFromTitle`).
  //
  // Van gyártó, aki a hosszt EGYETLEN mezőben sem közli, mert a modellnév
  // ELEJE maga a méret. Élesben (red.equipment): a spec-blokk `Width` /
  // `Board Thickness` / `Board Weight` mezőket ad, hosszt nem — az a címben
  // áll: `10'8" Ride MSL Inflatable Paddle Board Package.` A kinyerő emiatt
  // EGYETLEN terméket sem adott erről a forrásról (a hiányzó hossz kizár).
  //
  // MIÉRT OPT-IN, és miért a legutolsó lépés: a cím sokszor NEM a deszka
  // méretét viseli (csomag-méret, evező-hossz, „12 db" mennyiség), ezért ez
  // csak ott szabad, ahol MÉRTÜK, hogy a cím eleje a deszka hossza. A
  // címkézett és a hármas alak mindig ELŐBB dönt.
  //
  // ŐRSZEM: CSAK AKKOR, HA VAN SZÉLESSÉG. Élesben mérve (red.equipment) a
  // kockázat nem elméleti: a bolt kiegészítőinek a címében ott a deszka
  // mérete, amihez valók — `FFC Carbon Rod for Elite` (14'0"), `Compact
  // Backpack (available with 8'10")`. Ezek a cím alapján 381 és 269 cm
  // „hosszú deszkák" lettek, és a gyanú-jelzés sem fogta meg őket, mert a
  // szám hihető. A DESZKA viszont MINDIG kiírja a szélességét a
  // spec-blokkban; a hátizsák és az uszony-rúd nem.
  if (specs.lengthCm === null && specs.widthCm !== null && lengthFromTitle) {
    // Az ELSŐ láb(-hüvelyk) token a címben. Nem horgonyozunk a cím elejére:
    // élesben (red.equipment) a `<title>` a MÁRKANÉVVEL kezdődik —
    // `Red Paddle Co 10'8\" Ride MSL Inflatable Paddle Board Package`.
    //
    // Az ELSŐ találat azért helyes, mert a méret a MODELLNÉV része, és az a
    // cím elején áll; a mögötte jövő csomag-adatok (`… Package`, `10L dry
    // bag`) már nem láb-jelet viselnek. A láb-jel maga is szűk minta: puszta
    // szám sosem minősül hossznak.
    const token = rawTitle.match(/(\d+\s*['′’]\s*\d*\s*(?:''|"|”|″|’’)?)/);
    if (token?.[1] !== undefined) specs.lengthCm = parseDimensionCm(token[1]);
  }
  if (specs.lengthCm === null) return null;

  const brandName = normalizeBrandName(defaultBrandName);
  const modelName = cleanModelName(rawTitle, brandName, titleNoiseWords, titleKeepSize);
  if (modelName === "") return null;

  // A gyártó használat-értékelése. Ha a SZÖRF vezet, a terméket NEM gyűjtjük
  // (2026-08-19-i döntés: „a surf egy teljesen más dolog, mi a SUP-okra
  // fókuszálunk") — ez a szörf-kizárás gyártói adatból, nem névlistából.
  // A SZÖRF-KIZÁRÁS itt marad, nem módszerként: ez nem besorolás, hanem a
  // termék ELDOBÁSA. A `usageBars` módszer csak annyit mond, hogy nincs
  // találata; a „ne is gyűjtsük" döntés a hívóé.
  if (boardTypeFromUsage(html) === "surf") return null;

  const extracted: ExtractedProduct = {
    sourceUrl,
    brandName,
    modelName,
    rawTitle,
    modelYear:
      extractModelYear(rawTitle) ?? modelYearFromProductCode(pageText, brandName),
    // Gyártói oldal: árat nem viszünk (ár-megjelenítési politika).
    priceHuf: null,
    inStock: null,
    // A felhasználók sokszor KÉP alapján döntenek, ezért a termékkép fontos.
    // Horgony a cikkszám, majd a modellnév — nem „az oldal első képe", mert az
    // a fejléc-logó lenne (élesben 30+ img van egy oldalon).
    // Horgonyok, a legpontosabbtól: cikkszám → teljes modellnév → a modellnév
    // ELSŐ SZAVA (a családnév; a fájlnév gyakran csak azt viseli:
    // „Coral-R-1.png", „mega_frontback.png").
    imageUrl: displayImageUrl(
      absoluteUrl(
        findProductImage(
          html,
          // A TERMÉK-URL végén álló cikkszám a legerősebb horgony, ahol van:
          // a bolt ugyanazt a számot írja a képfájlba is. Élesben
          // (jobesports.com): a `…-486425010/` termékoldalon a kép
          // `/uploads/product/486425010-big.jpg` — enélkül a pozíció-fallback
          // a fejléc KOSÁR-IKONJÁT adta termékképnek.
          codeFromUrl(sourceUrl),
          findModelCode(pageText),
          modelName,
          modelName.split(/\s+/)[0] ?? null,
        ),
        sourceUrl,
      ),
    ),
    // GALÉRIA a HTML-oldalról — KIZÁRÓLAG a cikkszám-horgonnyal. A pozíció
    // vagy a modellnév itt nem lenne elég: a „Related Products" blokk MÁS
    // termékek fotóit is felkínálná (ugyanaz a csapda, ami az „ALUMINUM OARS"
    // hibát okozta). A cikkszám viszont termék-specifikus — a szomszéd termék
    // képén más szám áll.
    imageUrls: galleryByCode(html, codeFromUrl(sourceUrl), sourceUrl),
    // A besorolási tipphez a cím ÉS az URL kategória-szegmense — utóbbi a
    // gyártó SAJÁT besorolása (`/products/racing/race/`, `/products/youth/…`),
    // tehát pontosabb, mint bármilyen szöveg-heurisztika. A teljes
    // oldalszöveget SZÁNDÉKOSAN nem használjuk: a navigáció minden oldalon
    // felsorol minden kategóriát (ld. az `extractProduct` doc-kommentjét).
    // A kategória forrásai, ELSŐBBSÉGI sorrendben:
    //  1. a terméknév + az URL kategória-szegmense (a gyártó termékvonala),
    //  2. a gyártó SAJÁT használat-értékelése (`usage-rating.ts`).
    // A második azért kell, mert a marketing-kategóriák (`/products/glowing/`,
    // `/products/family/`) nem mondanak semmit a HASZNÁLATRÓL — a százalékos
    // sávok viszont igen.
    //  3. a gyártó saját LEÍRÁSA („the perfect all-around board for…"), ha a
    //     használat-sávok más készletet mutatnak (NUTS: TRACKING/STABILITY).
    // A recept által KÉRT módszerek, a kért sorrendben (F2.1-utó-45) — lista
    // hiányában MIND, a mai sorrendben, tehát a viselkedés változatlan.
    ...runCategoryMethods(selectCategoryMethods(categoryMethods), {
      html,
      pageText,
      rawTitle,
      sourceUrl,
      categoryClass,
      boardTypeByUrl,
      description: "",
    }),
    specs,
    accessoryType: null,
  };

  // Az URL útvonala erős, termékspecifikus jel: az `aquamarina.com` a
  // kategóriát is beleírja (`/products/reinforced-kayak/betta/`).
  let pathHint = "";
  try {
    pathHint = decodeURIComponent(new URL(sourceUrl).pathname).replace(
      /[-_/]+/g,
      " ",
    );
  } catch {
    pathHint = "";
  }

  const classification = classifyProduct({
    ...extracted,
    classificationHint: `${pathHint} ${headlineBeforeSpecs(pageText)}`,
  });
  if (classification.kind === "ignore") return null;
  extracted.accessoryType =
    classification.kind === "accessory" ? classification.accessoryType : null;
  return extracted;
}

/**
 * MÉRETENKÉNTI jelöltek egy termékoldalból (F2.1-utó-35).
 *
 * A legtöbb oldal EGY deszkáról szól — ilyenkor egyelemű a lista, és minden
 * pontosan úgy viselkedik, mint eddig. Van viszont olyan gyártó
 * (élesben: fanatic.com), amelyik EGY oldalon a modellcsalád MINDEN méretét
 * felsorolja egyetlen spec-táblában. A SUP-nál a MÉRET maga a termék (a
 * Deszkaválasztó hossz/szélesség alapján pontoz), ezért ilyenkor méretenként
 * külön jelölt születik — ugyanaz az elv, mint a Shopify-ág
 * `expandShopifyProduct`-jánál.
 *
 * A JELÖLT URL-je méretenként EGYEDI (`?size=…`): a jelölt-sorokat a figyelő
 * URL szerint azonosítja, közös URL-lel a méretek felülírnák egymást.
 */
export function extractProductsFromPage(
  html: string,
  sourceUrl: string,
  defaultBrandName: string | null = null,
  options: PageExtractionOptions = {},
): ExtractedProduct[] {
  const base = extractProductFromPage(
    html,
    sourceUrl,
    defaultBrandName,
    options,
  );
  if (!base) return [];

  const pageText = options.overrideText ?? htmlToText(html);
  const transposed = parseTransposedSpecsBySize(pageText);
  if (transposed.length >= 2) {
    return transposed.map((size) => ({
      ...base,
      // A blokk első cellája a gyártó SAJÁT, méretet is viselő neve
      // („FLY AIR S|L|T 9'8\"") — ez pontosabb, mint a cím + méret ragasztása.
      modelName: sizedModelName(size.label, base.brandName) || base.modelName,
      sourceUrl: sizedUrl(sourceUrl, size.label),
      specs: size.specs,
    }));
  }

  // MÁSIK ELRENDEZÉS: méretenként MEGISMÉTELT címkézett blokk (boteboard.com).
  // A fejléc itt puszta méret („10′4″ Specs"), nem modellnév — a nevet ezért a
  // CÍMBŐL (illetve a JSON-LD-ből) kapott alapnévhez ragasztjuk. Enélkül két
  // azonos nevű „WULF Aero" jelölt születne, holott két külön deszkáról van
  // szó (250 kontra 315 LBS teherbírás).
  const labeled = parseLabeledSpecsBySize(pageText);
  if (labeled.length < 2) return [base];
  return labeled.map((size) => ({
    ...base,
    modelName: `${base.modelName} ${size.label}`,
    sourceUrl: sizedUrl(sourceUrl, size.label),
    // A felfújhatóság az EGÉSZ oldal szövegéből derül ki (a méret-blokk csak a
    // „AeroULTRA Technology" szót viseli), ezért az alaptermékét tartjuk meg,
    // ha a blokk nem mondja ki.
    specs: { ...size.specs, inflatable: size.specs.inflatable ?? base.specs.inflatable },
  }));
}

/** Méretenként EGYEDI jelölt-URL — közös URL-lel a méretek felülírnák egymást. */
function sizedUrl(sourceUrl: string, label: string): string {
  return `${sourceUrl}${sourceUrl.includes("?") ? "&" : "?"}size=${sizeSlug(label)}`;
}

/**
 * MÉRETENKÉNTI bontás CÍMKÉZETT spec-blokkokból (boteboard.com, 2026-08-29).
 *
 * A `parseTransposedSpecsBySize` testvére, MÁS elrendezésre. Ott EGY
 * címke-blokk alatt állnak a méretek értéksorai (táblázat-fej + sorok); itt
 * viszont a gyártó a TELJES címkézett blokkot MEGISMÉTLI méretenként, egy
 * méret-fejléc alatt:
 *
 *   10′4″ Specs                 (vagy: `10'6" BREEZE AERO`)
 *   Dimensions:  10′4″ L × 34″ W × 6″ D
 *   Capacity:    250 LBS
 *   Avg. Weight: 20 LBS
 *   …
 *   11′4″ Specs
 *   Dimensions:  11′4″ L × 34″ W × 6″ D
 *   …
 *
 * A szokásos `parseSpecsFromText` ilyen lapon a MÁSODIK méretet elveszti: a
 * címke-kereső az első találatot veszi, és az a 10′4″-é. A SUP-nál viszont a
 * méret maga a termék — a WULF Aero 10′4″ és 11′4″ két külön deszka, más
 * teherbírással (250 kontra 315 LBS).
 *
 * MI VÉD A TÉVES DARABOLÁS ELLEN — nem a fejléc alakja, hanem az EGYEZÉS:
 * a fejléc kimondja a hosszt, és a blokkból kiolvasott hossznak ezzel EGYEZNIE
 * kell (1 cm tűréssel). Ez nem elméleti óvatosság: ugyanezen a lapon a
 * VARIÁNS-VÁLASZTÓ gombjai (`10'4"`, `11'4"`) alakra pontosan ugyanolyan
 * fejlécek, csak nem áll mögöttük spec-blokk. Az egyezés-vizsgálat ezeket
 * némán elejti, a valódi blokkokat pedig átengedi.
 *
 * AZONOS MÉRET KÉTSZER: ha mégis két fejléc ad ugyanarra a méretre blokkot, a
 * TÖBB kitöltött mezőt adó nyer — a fél blokk sosem írhatja felül a teljeset.
 */
const SIZE_HEADING = /^(\d{1,2}\s*['\u2019\u2032](?:\s*\d{1,2}\s*(?:''|["\u201d\u2033])?)?)(?:\s+[A-Za-z][\w.'-]*){0,3}$/;
/** Egy méret-blokk legfeljebb ennyi sor — a spec-blokk élesben ~15. */
const SIZED_BLOCK_MAX_LINES = 40;
/** A fejléc és a blokk hossza legfeljebb ennyivel térhet el (cm). */
const SIZED_LENGTH_TOLERANCE_CM = 1;

export function parseLabeledSpecsBySize(text: string): SizedSpecs[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const heads: { at: number; label: string; lengthCm: number }[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.length > 40) continue;
    const match = line.match(SIZE_HEADING);
    if (match?.[1] === undefined) continue;
    const lengthCm = parseDimensionCm(match[1]);
    if (lengthCm === null) continue;
    heads.push({ at: i, label: normalizeSizeLabel(match[1]), lengthCm });
  }
  if (heads.length < 2) return [];

  const byLabel = new Map<string, SizedSpecs>();
  for (let k = 0; k < heads.length; k += 1) {
    const head = heads[k];
    if (head === undefined) continue;
    const next = heads[k + 1]?.at ?? lines.length;
    const end = Math.min(next, head.at + 1 + SIZED_BLOCK_MAX_LINES);
    const specs = parseSpecsFromText(lines.slice(head.at + 1, end).join("\n"));
    // A FEJLÉC MONDJA KI, melyik deszkáé a blokk. Ha a kiolvasott hossz nem
    // ezt adja, akkor nem spec-blokk állt mögötte (variáns-gomb, prózasor).
    if (
      specs.lengthCm === null ||
      Math.abs(specs.lengthCm - head.lengthCm) > SIZED_LENGTH_TOLERANCE_CM
    ) {
      continue;
    }
    const seen = byLabel.get(head.label);
    if (seen === undefined || filledSpecFields(specs) > filledSpecFields(seen.specs)) {
      byLabel.set(head.label, { label: head.label, specs });
    }
  }
  return byLabel.size < 2 ? [] : [...byLabel.values()];
}

/**
 * EGYSÉGES méretjelölés a modellnévhez: `10\u20324\u2033` és `10'4"` ugyanaz a
 * deszka. Élesben (boteboard.com) a WULF tipográfiai, a Breeze egyenes jelet
 * használ UGYANAZON a boltban — a katalógusban ne két írásmód szerepeljen.
 */
function normalizeSizeLabel(label: string): string {
  return label
    .replace(/\s+/g, "")
    .replace(/[\u2019\u2032]/g, "'")
    .replace(/''|[\u201d\u2033]/g, '"');
}

/** Hány mezőt tölt ki ez a specifikáció? (Az azonos méretű blokkok döntője.) */
function filledSpecFields(specs: BoardSpecs): number {
  return (["lengthCm", "widthCm", "thicknessCm", "volumeL", "weightKg", "maxLoadKg"] as const)
    .filter((key) => specs[key] !== null).length;
}

/** A méret-címke mint modellnév: márkanév nélkül, a MÉRET megtartásával. */
function sizedModelName(label: string, brandName: string | null): string {
  let text = decodeEntities(label).replace(/\s+/g, " ").trim();
  if (brandName)
    text = text.replace(new RegExp(escapeRegExp(brandName), "gi"), " ");
  return text.replace(/\s+/g, " ").trim();
}

/** URL-be tehető azonosító a méret-címkéből. */
function sizeSlug(label: string): string {
  return (
    decodeEntities(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "1"
  );
}

/**
 * TÖBBES HASZNÁLAT a gyártói prózából (F2.1-utó-44).
 *
 * MIÉRT KÜLÖN FÜGGVÉNY, és miért nem a teljes oldalszövegre eresztjük rá a
 * `boardTypesFromProse`-t: a NAVIGÁCIÓS MENÜ minden termékoldalon felsorolja a
 * gyártó ÖSSZES kategóriáját („Paddleboards All-round / Wave … Touring …
 * Race"). Egy kulcsszó-alapú olvasó ott mindent megtalálna, és minden deszka
 * minden kategóriát megkapna — ez a katalógus leggyorsabb elrontása lenne.
 *
 * AMIT KERESÜNK, az egy ÁLLÍTÁS a termékről, nem egy menüpont:
 *
 *   „Ideal for both **all-around** paddling **and** **touring**, it features…"
 *
 * Három feltétel együtt — mindhárom a menü ellen véd:
 *  1. EGY MONDATON belül áll a két kategória-szó (a menü nem mondat);
 *  2. KÖTŐSZÓ van közöttük (`and`, `és`, `valamint`, `both … and`);
 *  3. a mondat rövid (a menü-blokk hosszú, mert nincs benne mondatvég).
 *
 * A találat CSAK JAVASLAT: a moderátor hagyja jóvá. Egy téves plusz kategória
 * ugyanis nem hiány, hanem HAMIS ajánlás — a deszka olyan célnál jönne elő,
 * amire a gyártó nem szánta.
 */
const MULTI_USE_MAX_SENTENCE = 300;
/** A két kategória-szó legfeljebb ennyi karakterre álljon egymástól. */
const MULTI_USE_MAX_GAP = 70;

export function multiUseFromProse(text: string): BoardType[] {
  const folded = foldText(text);
  const keywords: [BoardType, RegExp][] = [
    ["kids", /\b(?:gyerek|junior|kids|youth)/g],
    ["fishing", /\b(?:horgasz|fishing|angler)/g],
    // A `river` az EGYETLEN típusunk, ami HELYNÉV is: a „choppy waters or
    // rivers" mondatban a folyó víz, nem besorolás. Élesben (fanatic.com,
    // BLITZ AIR) ebből lett volna vadvízi deszka egy túradeszkából. Ezért itt
    // csak a jelzős/összetett alak számít — a puszta „river(s)" nem.
    ["river", /\b(?:folyami|vadvizi|whitewater|river[ -]?(?:sup|board|deszka))/g],
    ["race", /\b(?:verseny|racing|race)/g],
    ["yoga", /\b(?:joga|yoga|pilates)/g],
    ["touring", /\b(?:tura|touring|explor)/g],
    ["allround", /\b(?:allround|all-round|all round|all-around|all around|univerzalis)/g],
  ];
  const conjunction = /\b(?:and|es|valamint|vagy|or)\b/;

  const found = new Set<BoardType>();
  for (const sentence of folded.split(/[.!?]+|\n/)) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0 || trimmed.length > MULTI_USE_MAX_SENTENCE) continue;

    const hits: { type: BoardType; at: number }[] = [];
    for (const [type, pattern] of keywords) {
      pattern.lastIndex = 0;
      const match = pattern.exec(trimmed);
      if (match) hits.push({ type, at: match.index });
    }
    if (hits.length < 2) continue;

    hits.sort((a, b) => a.at - b.at);
    for (let i = 0; i < hits.length - 1; i += 1) {
      const left = hits[i]!;
      const right = hits[i + 1]!;
      if (right.at - left.at > MULTI_USE_MAX_GAP) continue;
      // A KÖTŐSZÓ a kettő KÖZÖTT álljon — ez köti össze őket állítássá.
      if (!conjunction.test(trimmed.slice(left.at, right.at))) continue;
      found.add(left.type);
      found.add(right.type);
    }
  }
  return [...found];
}
