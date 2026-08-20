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
import { displayImageUrl, MAX_GALLERY_CANDIDATES } from "./images.ts";
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
  "itiwit / decathlon": "Itiwit",
  itiwit: "Itiwit",
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
export function normalizeBrandName(raw: string | null | undefined): string | null {
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
export function extractModelYear(text: string, now = new Date()): number | null {
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
export function cleanModelName(rawTitle: string, brandName?: string | null): string {
  // Az entitás-feloldás ITT történik, mert a nyers cím nem csak HTML-ből jön:
  // a Shopify `/products.json` és a JSON-LD `name` mezője is entitást ad
  // (`Indiana 12&#039;6 Touring`) — enélkül az `&#039;` a modellnév része lenne.
  let text = decodeEntities(rawTitle).replace(/\s+/g, " ").trim();

  if (brandName) {
    // A márkanevet bárhol kivesszük (nem csak prefixként): „Aqua Marina Vapor
    // 10'4" és „Vapor Aqua Marina" ugyanarra a modellnévre normalizálódik.
    const pattern = new RegExp(escapeRegExp(brandName), "gi");
    text = text.replace(pattern, " ");
  }

  text = text
    // méret-jelölések: 10'6", 10' 6'', 320 cm, 3,2 m, 32"
    .replace(/\d+\s*'\s*\d*\s*(?:''|"|”|’’)?/g, " ")
    .replace(/\d+([.,]\d+)?\s*(cm|mm|m|inch|coll|"|”)\b/gi, " ")
    .replace(/\b(20\d{2})(-(es|as|ös|os))?\b/g, " ");

  for (const word of NOISE_WORDS) {
    text = text.replace(wholeWordRegExp(word), " ");
  }

  return text
    .replace(/[|/\\~·•–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  return new RegExp(`(?<![\\p{L}\\d])${escapeRegExp(word)}(?![\\p{L}\\d])`, "giu");
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
  // A `(?!')` védi ki, hogy egy dupla-aposztróffal írt hüvelyk-jel (`32''`,
  // gyakori ASCII-helyettesítő a valódi ″ karakterre — élesben mért eset,
  // indiana-paddlesurf.com "Width Foot/Inch: 32''") ne illeszkedjen láb-
  // jelként (az első `'`-t követő MÁSODIK `'` enélkül "elveszett" karakterré
  // vált volna, a 32-t pedig lábnak olvastuk volna hüvelyk helyett — 32 láb =
  // 975 cm a valós 81,3 cm helyett).
  // A tipográfiai PRIME-ok (′ U+2032 láb, ″ U+2033 hüvelyk) is számítanak:
  // élesben (funwaterboard.com) a méret `10′6″ * 33″ * 6″` alakban áll, és a
  // sima aposztrófra szűrve az egész sor láthatatlan maradt.
  const feetInches = text.match(/(\d+)\s*['′](?!['′])\s*(\d+(?:[.,]\d+)?)?\s*(?:''|"|”|″|’’)?/);
  if (feetInches) {
    const feet = toNumber(feetInches[1] ?? "");
    const inches = feetInches[2] ? toNumber(feetInches[2]) : 0;
    if (feet !== null && inches !== null) {
      return round1(feet * CM_PER_FOOT + inches * CM_PER_INCH);
    }
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

  const inch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:''|"|”|″|inch|in\b|coll)/i);
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
  lengthCm: ["hosszúság", "hossz", "length"],
  widthCm: ["szélesség", "szeles", "width"],
  thicknessCm: ["vastagság", "magasság", "thickness"],
  volumeL: ["térfogat", "volumen", "volume"],
  // A csupasz „weight" szándékosan hiányzik: a „Max weight: 140 kg" sorban
  // beleillene, és a TEHERBÍRÁST írná a deszka saját súlyaként.
  // A „net weight" ELÉG specifikus ahhoz, hogy ne ütközzön a teherbírással —
  // az Aqua Marina hivatalos adatlapja (aquamarina.com) ezt a címkét használja
  // a deszka saját súlyára, „MAX. PAYLOAD" mellett.
  weightKg: ["deszka súlya", "saját súly", "súly", "tömeg", "board weight", "net weight"],
  maxLoadKg: [
    "teherbírás",
    "terhelhetőség",
    "max terhelés",
    "maximális terhelés",
    // Élesben mért címke (Bluefin): "Max User Weight" — a "max weight"
    // RÉSZSTRING-illesztés ezt nem fogja meg, mert közte van a "user" szó.
    "max user weight",
    "max load",
    "max weight",
    "capacity",
    // Aqua Marina hivatalos adatlap (aquamarina.com): „MAX. PAYLOAD".
    // A `kg`-kötelezettség miatt a mellette kiírt font-érték („308 lbs /
    // 140 kg") nem téveszt meg — a 140 nyer, nem a 308.
    "payload",
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
} as const satisfies Record<keyof Omit<BoardSpecs, "inflatable">, readonly string[]>;

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
    labelSearch(text, labels, excludePrecededBy, true) ??
    labelSearch(text, labels, excludePrecededBy, false)
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
  const kg = head.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
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
function fillFromLabelledLines(text: string, specs: BoardSpecs): void {
  const fields = ["volumeL", "maxLoadKg", "weightKg"] as const;
  const lines = text.split("\n").map((line) => line.trim());
  for (let i = 0; i < lines.length - 1; i += 1) {
    const label = foldText(lines[i] ?? "").replace(/\s*:$/, "");
    // A címke-sor legyen RÖVID és szám nélküli — így egy prózai mondat, ami
    // véletlenül tartalmazza a címkeszót, nem minősül címkének. A valós
    // címkék többszavasak („Maximum load capacity"), ezért nem pontos
    // egyezést kérünk, hanem tartalmazást ezen a szűk soron belül.
    if (label === "" || label.length > 40 || /\d/.test(label)) continue;
    const value = (lines[i + 1] ?? "").match(/^(?:up to|max\.?|~)?\s*(\d+(?:[.,]\d+)?)$/i);
    if (!value) continue;
    for (const field of fields) {
      if (specs[field] !== null) continue;
      if (!SPEC_LABELS[field].some((candidate) => label.includes(foldText(candidate)))) continue;
      specs[field] = toNumber(value[1] ?? "");
      break;
    }
  }
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
  const paren = text.slice(from, from + VALUE_WINDOW_CHARS).match(/^\s*\([^)]*\)/);
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
      const excluded = excludePrecededBy.some((word) => before.includes(foldText(word)));
      if (excluded) continue;

      const after = folded.slice(index + needle.length, index + needle.length + 4);
      if (/^[ae]v[ae]l/.test(after)) continue;
      // Az első menetben KÖTELEZŐ a kettőspont (esetleg szóköz után) —
      // a spec-táblázat írásmódja.
      if (requireColon && !/^\s*:/.test(after)) continue;
      // ZÁRÓJELEN BELÜLI címkeszó nem címke, hanem MAGYARÁZAT.
      if (isInsideParens(text, index)) continue;

      const window = windowAfterLabel(text, index + label.length);
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

function tripleFromMatch(match: RegExpMatchArray): { lengthCm: number; widthCm: number; thicknessCm: number } | null {
  const length = toNumber(match[1] ?? "");
  const width = toNumber(match[2] ?? "");
  const thickness = toNumber(match[3] ?? "");
  if (length === null || width === null || thickness === null) return null;
  const isInches = /^in/i.test(match[4] ?? "");
  const toCm = (v: number) => round1(isInches ? v * CM_PER_INCH : v);
  return { lengthCm: toCm(length), widthCm: toCm(width), thicknessCm: toCm(thickness) };
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
    const [length, width, thickness] = parts.slice(0, 3).map((part) => parseDimensionCm(part));
    if (length === undefined || width === undefined || thickness === undefined) continue;
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
    const excluded = excludePrecededBy.some((word) => before.includes(foldText(word)));
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

function parsePairDimensionCm(text: string): { lengthCm: number; widthCm: number } | null {
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

  for (const key of ["lengthCm", "widthCm", "thicknessCm"] as const) {
    const window = valueAfterLabel(text, SPEC_LABELS[key], ["paddle"]);
    if (window !== null) specs[key] = parseDimensionCm(window);
  }

  // Ha a fenti KÜLÖN címkék nem adtak mindhárom méretet, próbáljuk az
  // ÖSSZEVONT "Dimensions: 325 x 82 x 16cm" formát — csak a hiányzó mezőket
  // töltjük ki belőle, a már megtalált (specifikusabb címkéjű) érték marad.
  if (specs.lengthCm === null || specs.widthCm === null || specs.thicknessCm === null) {
    const dimensionsWindow = valueAfterLabel(text, DIMENSIONS_LABELS, ["bag", "package", "táska", "csomag", "szállítás", "shipping"]);
    const triple = dimensionsWindow !== null ? parseTripleDimensionCm(dimensionsWindow) : null;
    if (triple !== null) {
      if (specs.lengthCm === null) specs.lengthCm = triple.lengthCm;
      if (specs.widthCm === null) specs.widthCm = triple.widthCm;
      if (specs.thicknessCm === null) specs.thicknessCm = triple.thicknessCm;
    } else if (specs.lengthCm === null && specs.widthCm === null && dimensionsWindow !== null) {
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
  if (specs.lengthCm === null || specs.widthCm === null || specs.thicknessCm === null) {
    const bareTriple = findBareTripleDimension(text, ["bag", "package", "táska", "csomag", "szállítás", "shipping"]);
    if (bareTriple !== null) {
      if (specs.lengthCm === null) specs.lengthCm = bareTriple.lengthCm;
      if (specs.widthCm === null) specs.widthCm = bareTriple.widthCm;
      if (specs.thicknessCm === null) specs.thicknessCm = bareTriple.thicknessCm;
    }
  }

  const volumeWindow = valueAfterLabel(text, SPEC_LABELS.volumeL);
  if (volumeWindow !== null) {
    const match = volumeWindow.match(/(\d+(?:[.,]\d+)?)\s*(?:l\b|liter|litre)/i);
    specs.volumeL = match ? toNumber(match[1] ?? "") : null;
  }

  for (const key of ["weightKg", "maxLoadKg"] as const) {
    const window = valueAfterLabel(text, SPEC_LABELS[key]);
    if (window === null) continue;
    specs[key] = parseWeightKg(window);
  }

  // UTOLSÓ MENET: címke a SAJÁT SORÁBAN, alatta PUSZTA SZÁM. Csak a még
  // üresen maradt mezőket tölti (ld. `fillFromLabelledLines`).
  fillFromLabelledLines(text, specs);

  specs.inflatable = detectInflatable(text);
  return specs;
}

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
    ["allround", ["allround", "all-round", "all round", "all-around", "all around", "univerzalis"]],
  ];
  for (const [type, needles] of rules) {
    if (needles.some((needle) => folded.includes(needle))) return type;
  }
  return null;
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
  ["taska", ["evezotaska", "evezo taska", "paddle bag", "evezotarto", "evezo tarto"]],
  ["szarazzsak", ["szarazzsak", "dry bag", "drybag"]],
  ["mentomelleny", ["mentomellen", "mellen", "life vest", "life jacket", "pfd"]],
  ["uszony", ["uszony", "finbox", "fin box"]],
  ["poraz", ["poraz", "leash"]],
  ["pumpa", ["pumpa", "pump"]],
  // Bare "paddle" szándékosan hiányzik: az beleillene a "paddleboard"/"paddle
  // board" BOARD_NOUNS-szóba is — csak az egyértelmű "evező"/"paddle blade" számít.
  // Az „oars" viszont egyértelmű: evezőlapát, sosem deszka (élesben:
  // zraysports.com „ALUMINUM OARS"). A csupasz „oar" SZÁNDÉKOSAN hiányzik: a
  // „b-oar-d" részstringje lenne, tehát minden deszkára illeszkedne.
  ["evezo", ["evezo", "paddle blade", "oars"]],
  ["taska", ["hatizsak", "taska", "backpack", "board bag", "carry bag"]],
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
];

/** A deszka-mivolt pozitív jelei a névben/leírásban. */
const BOARD_NOUNS = ["deszka", "board", "isup", "i-sup", "paddleboard", "paddle board"];

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
  const identity = foldText(`${product.rawTitle} ${product.classificationHint ?? ""}`);
  if (NEVER_BOARD_KEYWORDS.some((word) => identity.includes(word))) {
    return { kind: "ignore" };
  }

  const lengthInRange =
    specs.lengthCm !== null &&
    specs.lengthCm >= BOARD_LENGTH_MIN_CM &&
    specs.lengthCm <= BOARD_LENGTH_MAX_CM;
  // A méret-alapú rövidzár csak ÖNMAGÁBAN ELLENTMONDÁSMENTES adatra szólal
  // meg: egy deszka SOSEM szélesebb, mint amilyen hosszú.
  //
  // ÉLESBEN MÉRT HIBA (zraysports.com, 2026-08-20): a kiegészítő-oldalakon
  // (ALUMINUM OARS, Pump, LEASH, vízhatlan táska) nincs saját spec-blokk, a
  // „Related Products" viszont SUP-deszkákat sorol fel — a laza szöveg-parse
  // onnan szedte fel a méretet, és mindegyik kiegészítő „396,2 × 396,2 cm,
  // 150 kg teherbírás" DESZKAKÉNT jött volna be. A rövidzár szándékosan
  // erősebb minden kulcsszónál (egy rosszul címzett deszkát a saját adata
  // ment meg) — de csak akkor, ha az az adat egyáltalán deszkáé lehet.
  const dimensionsCoherent = specs.widthCm === null || specs.widthCm < (specs.lengthCm ?? 0);
  if (lengthInRange && dimensionsCoherent && (specs.volumeL !== null || specs.maxLoadKg !== null)) {
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

  const hasBoardNoun = BOARD_NOUNS.some((noun) => folded.includes(noun));
  const hasSup = /\bsup\b/.test(folded);
  // A méret itt is csak ELLENTMONDÁSMENTESEN számít bizonyítéknak (ld. fent).
  const isBoard =
    hasBoardNoun || (hasSup && product.boardType !== null) || (lengthInRange && dimensionsCoherent);
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
    if (node.priceSpecification !== undefined) stack.push(node.priceSpecification);
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
  const boardType = guessBoardType(`${rawTitle}\n${description}`);
  // A besorolás itt is lefut (nem csak a crawl.ts vezérlésében), hogy a
  // moderációs UI a kategória-legördülőt a figyelő tippjével előválaszthassa —
  // ugyanaz a minta, mint a `boardType` tippnél (a moderátor felülbírálhatja).
  const classification = classifyProduct({ rawTitle, modelName, boardType, specs });

  return {
    sourceUrl,
    brandName,
    modelName,
    rawTitle,
    modelYear: extractModelYear(`${rawTitle} ${description}`),
    priceHuf: parsePriceHuf(node.offers),
    inStock: parseAvailability(node.offers),
    imageUrl: displayImageUrl(firstString(node.image)),
    boardType,
    specs,
    accessoryType: classification.kind === "accessory" ? classification.accessoryType : null,
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
    return decodeURIComponent(new URL(sourceUrl).pathname).replace(/[-_/]+/g, " ");
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
function parseTransposedSpecs(text: string): BoardSpecs | null {
  const KNOWN: Record<string, keyof BoardSpecs | "skip"> = {
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
  };

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  for (let start = 0; start < lines.length; start += 1) {
    const labels: (keyof BoardSpecs | "skip")[] = [];
    let i = start;
    while (i < lines.length) {
      const key = (lines[i] ?? "").toLowerCase().replace(/\s+/g, " ");
      const field = KNOWN[key];
      if (field === undefined) break;
      labels.push(field);
      i += 1;
    }
    if (labels.length < 4) continue;

    const values = lines.slice(i, i + labels.length);
    if (values.length < labels.length) continue;

    const specs: BoardSpecs = { ...EMPTY_SPECS };
    for (let k = 0; k < labels.length; k += 1) {
      const field = labels[k];
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
          specs.volumeL = match ? toNumber(match[1] ?? "") : null;
          break;
        }
        case "weightKg":
        case "maxLoadKg": {
          // A `kg` kötelező: a gyártó a fontot is kiírja („20.1lbs / 9.1kg").
          const match = value.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
          specs[field] = match ? toNumber(match[1] ?? "") : null;
          break;
        }
      }
    }
    if (specs.lengthCm !== null) {
      specs.inflatable = detectInflatable(text);
      return specs;
    }
  }
  return null;
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
function galleryByCode(html: string, code: string | null, sourceUrl: string): string[] {
  if (code === null) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/gi)) {
    if (out.length >= MAX_GALLERY_CANDIDATES) break;
    const src = match[1] ?? "";
    const file = src.split("/").pop() ?? "";
    if (!file.includes(code)) continue;
    if (/logo|construction|technology|detail|icon|thumb|badge/i.test(file)) continue;
    const url = absoluteUrl(src, sourceUrl);
    if (url === null || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  // Az ELSŐ találat lesz a borító (`findProductImage` ugyanezt választja) —
  // a galériában tehát nem ismételjük meg.
  return out.slice(1);
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
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

export interface PageExtractionOptions {
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
}

export function extractProductFromPage(
  html: string,
  sourceUrl: string,
  defaultBrandName: string | null = null,
  options: PageExtractionOptions = {},
): ExtractedProduct | null {
  const { boardTypeByUrl = {}, titleSuffixes = [] } = options;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let rawTitle = htmlToText(titleMatch?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  for (const suffix of titleSuffixes) {
    const folded = foldText(rawTitle);
    const needle = foldText(suffix);
    if (needle !== "" && folded.endsWith(needle)) {
      rawTitle = rawTitle.slice(0, rawTitle.length - suffix.length).replace(/[\s|·–—-]+$/, "");
    }
  }
  if (rawTitle === "") return null;

  const pageText = htmlToText(html);
  // Elsőként a szokásos, címke-melletti parse; ha az üres, a két hasábos
  // („transzponált") elrendezés fallbackje.
  let specs = parseSpecsFromText(pageText);
  if (specs.lengthCm === null) {
    specs = parseTransposedSpecs(pageText) ?? specs;
  }
  if (specs.lengthCm === null) return null;

  const brandName = normalizeBrandName(defaultBrandName);
  const modelName = cleanModelName(rawTitle, brandName);
  if (modelName === "") return null;

  // A gyártó használat-értékelése. Ha a SZÖRF vezet, a terméket NEM gyűjtjük
  // (2026-08-19-i döntés: „a surf egy teljesen más dolog, mi a SUP-okra
  // fókuszálunk") — ez a szörf-kizárás gyártói adatból, nem névlistából.
  const usage = boardTypeFromUsage(html);
  if (usage === "surf") return null;
  const usageType = usage;

  // Moderátori rögzítés (a legerősebb jel): URL-részlet szerint.
  const pinnedType =
    Object.entries(boardTypeByUrl).find(([needle]) => sourceUrl.includes(needle))?.[1] ?? null;

  const extracted: ExtractedProduct = {
    sourceUrl,
    brandName,
    modelName,
    rawTitle,
    modelYear: extractModelYear(rawTitle),
    // Gyártói oldal: árat nem viszünk (ár-megjelenítési politika).
    priceHuf: null,
    inStock: null,
    // A felhasználók sokszor KÉP alapján döntenek, ezért a termékkép fontos.
    // Horgony a cikkszám, majd a modellnév — nem „az oldal első képe", mert az
    // a fejléc-logó lenne (élesben 30+ img van egy oldalon).
    // Horgonyok, a legpontosabbtól: cikkszám → teljes modellnév → a modellnév
    // ELSŐ SZAVA (a családnév; a fájlnév gyakran csak azt viseli:
    // „Coral-R-1.png", „mega_frontback.png").
    imageUrl: absoluteUrl(
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
    boardType:
      pinnedType ??
      guessBoardType(`${rawTitle} ${urlCategoryHint(sourceUrl)}`) ??
      usageType ??
      boardTypeFromDescription(pageText),
    specs,
    accessoryType: null,
  };

  // Az URL útvonala erős, termékspecifikus jel: az `aquamarina.com` a
  // kategóriát is beleírja (`/products/reinforced-kayak/betta/`).
  let pathHint = "";
  try {
    pathHint = decodeURIComponent(new URL(sourceUrl).pathname).replace(/[-_/]+/g, " ");
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
