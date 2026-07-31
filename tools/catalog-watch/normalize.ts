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
  let text = rawTitle.replace(/\s+/g, " ").trim();

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
  const feetInches = text.match(/(\d+)\s*'\s*(\d+(?:[.,]\d+)?)?\s*(?:''|"|”|’’)?/);
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

  const inch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:''|"|”|inch|in\b|coll)/i);
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
  weightKg: ["deszka súlya", "saját súly", "súly", "tömeg", "board weight"],
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
  ],
} as const satisfies Record<keyof Omit<BoardSpecs, "inflatable">, readonly string[]>;

/** Összevont "Hossz × Szélesség × Vastagság" méret-sor címkéi. */
const DIMENSIONS_LABELS = ["méretek", "dimensions"];

/**
 * Egy CÍMKÉZETT érték kiolvasása: a címke után következő ~40 karakterből
 * keressük a mértéket. A szűk ablak szándékos — enélkül a „Hosszúság" címke
 * egy jóval későbbi, más sorhoz tartozó számot szedne fel.
 *
 * `excludePrecededBy`: ha a címke-találat közvetlenül egy tiltott szó után
 * áll (pl. "Paddle Length", "Bag Dimensions"), a találatot ÁTUGORJA és a
 * SZÖVEGBEN KÉSŐBBI előfordulást keresi tovább — nem csak az elsőt nézi.
 */
function valueAfterLabel(
  text: string,
  labels: readonly string[],
  excludePrecededBy: readonly string[] = [],
): string | null {
  const folded = foldText(text);
  for (const label of labels) {
    const needle = foldText(label);
    let searchFrom = 0;
    for (;;) {
      const index = folded.indexOf(needle, searchFrom);
      if (index < 0) break;
      searchFrom = index + needle.length;

      const before = folded.slice(Math.max(0, index - 15), index).trimEnd();
      const excluded = excludePrecededBy.some((word) => before.endsWith(foldText(word)));
      if (excluded) continue;

      const window = text.slice(index + label.length, index + label.length + 40);
      if (/\d/.test(window)) return window;
    }
  }
  return null;
}

/**
 * "325 x 82 x 16cm" jellegű, EGY sorba írt hossz×szélesség×vastagság minta —
 * a boltok gyakran nem külön "Hosszúság"/"Szélesség"/"Vastagság" címkével,
 * hanem egyetlen "Dimensions:" sorral adják meg. `×` és `x` is elfogadott,
 * a szóköz a szám és az `x`/`cm` között opcionális (élesben látott: "82 x16cm").
 */
function parseTripleDimensionCm(
  text: string,
): { lengthCm: number; widthCm: number; thicknessCm: number } | null {
  const match = text.match(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm\b/i,
  );
  if (!match) return null;
  const lengthCm = toNumber(match[1] ?? "");
  const widthCm = toNumber(match[2] ?? "");
  const thicknessCm = toNumber(match[3] ?? "");
  if (lengthCm === null || widthCm === null || thicknessCm === null) return null;
  return { lengthCm: round1(lengthCm), widthCm: round1(widthCm), thicknessCm: round1(thicknessCm) };
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
    const dimensionsWindow = valueAfterLabel(text, DIMENSIONS_LABELS, ["bag", "package", "táska", "csomag"]);
    const triple = dimensionsWindow !== null ? parseTripleDimensionCm(dimensionsWindow) : null;
    if (triple !== null) {
      if (specs.lengthCm === null) specs.lengthCm = triple.lengthCm;
      if (specs.widthCm === null) specs.widthCm = triple.widthCm;
      if (specs.thicknessCm === null) specs.thicknessCm = triple.thicknessCm;
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
    const match = window.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
    specs[key] = match ? toNumber(match[1] ?? "") : null;
  }

  specs.inflatable = detectInflatable(text);
  return specs;
}

/** Felfújható vagy kemény deszka? Bizonytalanságnál null. */
export function detectInflatable(text: string): boolean | null {
  const folded = foldText(text);
  const inflatable = ["felfujhato", "inflatable", "isup", "i-sup", "pumpa"].some((w) =>
    folded.includes(w),
  );
  const rigid = ["kemeny deszka", "hardboard", "hard board", "rigid", "epoxy"].some((w) =>
    folded.includes(w),
  );
  if (inflatable && !rigid) return true;
  if (rigid && !inflatable) return false;
  return null;
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
    ["river", ["river", "folyo", "whitewater", "vadviz"]],
    ["race", ["race", "verseny", "racing"]],
    ["yoga", ["yoga", "joga", "fitness", "pilates"]],
    ["touring", ["touring", "tura", "explorer", "adventure"]],
    ["allround", ["allround", "all-round", "all round", "univerzalis"]],
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
  ["szarazzsak", ["szarazzsak", "dry bag", "drybag"]],
  ["mentomelleny", ["mentomellen", "mellen", "life vest", "life jacket", "pfd"]],
  ["uszony", ["uszony", "finbox", "fin box"]],
  ["poraz", ["poraz", "leash"]],
  ["pumpa", ["pumpa", "pump"]],
  // Bare "paddle" szándékosan hiányzik: az beleillene a "paddleboard"/"paddle
  // board" BOARD_NOUNS-szóba is — csak az egyértelmű "evező"/"paddle blade" számít.
  ["evezo", ["evezo", "paddle blade"]],
  ["taska", ["hatizsak", "taska", "backpack"]],
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
];

/** A deszka-mivolt pozitív jelei a névben/leírásban. */
const BOARD_NOUNS = ["deszka", "board", "isup", "i-sup", "paddleboard", "paddle board"];

/** Deszkahossz ésszerű tartománya cm-ben — ez a spec-alapú, DÖNTŐ jel. */
const BOARD_LENGTH_MIN_CM = 240;
const BOARD_LENGTH_MAX_CM = 520;

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
}): ProductClassification {
  const { specs } = product;
  const lengthInRange =
    specs.lengthCm !== null &&
    specs.lengthCm >= BOARD_LENGTH_MIN_CM &&
    specs.lengthCm <= BOARD_LENGTH_MAX_CM;
  if (lengthInRange && (specs.volumeL !== null || specs.maxLoadKg !== null)) {
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
  const isBoard = hasBoardNoun || (hasSup && product.boardType !== null) || lengthInRange;
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
 */
export function extractProduct(
  node: Record<string, unknown>,
  sourceUrl: string,
  pageText = "",
): ExtractedProduct | null {
  const rawTitle = firstString(node.name)?.replace(/\s+/g, " ").trim() ?? "";
  if (rawTitle === "") return null;

  const brandName = normalizeBrandName(firstString(node.brand ?? node.manufacturer));
  const description = firstString(node.description) ?? "";
  const haystack = `${rawTitle}\n${description}\n${pageText}`;

  const specs = parseSpecsFromText(haystack);
  // A cím méret-jelölése (10'6") a legmegbízhatóbb hossz-forrás: a bolt a
  // konkrét variánst nevezi meg vele. Csak akkor él, ha a spec-táblázat hallgat.
  if (specs.lengthCm === null && /\d\s*'/.test(rawTitle)) {
    specs.lengthCm = parseDimensionCm(rawTitle);
  }

  const modelName = cleanModelName(rawTitle, brandName);
  const boardType = guessBoardType(haystack);
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
    imageUrl: firstString(node.image),
    boardType,
    specs,
    accessoryType: classification.kind === "accessory" ? classification.accessoryType : null,
  };
}
