/**
 * catalog-watch — a GYÁRTÓ használat-értékelése → deszkatípus
 * (F2.1-utó-22, 2026-08-19).
 *
 * MIÉRT KELL: az Aqua Marina termékoldalai minden deszkát PONTOZNAK négy
 * használati mód szerint, százalékos sávokkal — ez a gyártó saját
 * állásfoglalása arról, mire való a deszka:
 *
 *   BLAZE:  ALL-AROUND/ENTRY 100% · GUIDE/EXPLORE 60% · SURF/WAVE 80% · RACE/TRAINING 40%
 *
 * A gyártó MARKETING-kategóriái (`/products/glowing/`, `/products/family/`,
 * `/products/light-weight/`, `/products/hybrid/`) ugyanis nem használati
 * kategóriák — a „Glowing" annyit tesz, hogy világít, nem azt, hogy mire jó.
 * Ezekre a URL-alapú tipp nem ad semmit, a pontozás viszont igen.
 *
 * Felhasználói kérés (2026-08-19): „ezeket mentsük el és egy következő
 * gyűjtésnél már ne legyenek kérdések" — ezért a besorolás innentől a
 * GYÁRTÓI ADATBÓL jön, nem eseti döntésekből.
 *
 * A SZÖRF SZÁNDÉKOSAN KIVÉTEL: ha a legmagasabb pontszám a SURF/WAVE, a
 * deszka szörf-deszka, amit a katalógus nem gyűjt (2026-08-19-i döntés:
 * „a surf egy teljesen más dolog, mi a SUP-okra fókuszálunk"). Ilyenkor a
 * függvény `"surf"`-öt ad vissza, és a hívó kihagyja a terméket.
 *
 * TISZTA modul: se hálózat, se adatbázis.
 */
import type { BoardType } from "./types.ts";

/** A négy értékelt használati mód → a mi kategóriánk (a szörfnek nincs). */
const USAGE_TO_TYPE: [pattern: RegExp, type: BoardType | "surf"][] = [
  [/all[\s-]*around|entry/i, "allround"],
  [/guide|explore|touring/i, "touring"],
  [/race|training/i, "race"],
  [/surf|wave/i, "surf"],
];

export interface UsageRating {
  label: string;
  percent: number;
  type: BoardType | "surf" | null;
}

/**
 * A használat-sávok kiolvasása a termékoldal HTML-jéből.
 *
 * A horgony az `aria-valuetext="100% (ALL-AROUND/ENTRY)"` attribútum — ez
 * kifejezetten a KÉPERNYŐOLVASÓKNAK szánt, ember által olvasható összefoglaló,
 * tehát stabilabb, mint a vizuális markup (osztálynevek, elrendezés).
 */
export function parseUsageRatings(html: string): UsageRating[] {
  const ratings: UsageRating[] = [];
  for (const match of html.matchAll(/aria-valuetext="(\d{1,3})%\s*\(([^")]+)\)"/gi)) {
    const percent = Number(match[1]);
    const label = (match[2] ?? "").trim();
    if (!Number.isFinite(percent) || label === "") continue;
    const found = USAGE_TO_TYPE.find(([pattern]) => pattern.test(label));
    ratings.push({ label, percent, type: found?.[1] ?? null });
  }
  return ratings;
}

/**
 * A legerősebb használati mód → kategória.
 *
 * `null`, ha nincs értékelés, vagy ha DÖNTETLEN van az élen — utóbbinál nem
 * választunk (két egyformán erős használat esetén a moderátor dönt).
 * `"surf"`, ha a szörf vezet: azt a katalógus nem gyűjti.
 */
export function boardTypeFromUsage(html: string): BoardType | "surf" | null {
  const ratings = parseUsageRatings(html).filter((r) => r.type !== null);
  if (ratings.length === 0) return null;

  const top = Math.max(...ratings.map((r) => r.percent));
  const leaders = ratings.filter((r) => r.percent === top);
  // Döntetlen KÜLÖNBÖZŐ kategóriák között → nem tippelünk.
  const distinct = new Set(leaders.map((r) => r.type));
  if (distinct.size !== 1) return null;
  return leaders[0]?.type ?? null;
}

/**
 * Kategória a gyártó SAJÁT LEÍRÁSÁBÓL — ha kimondja, mi a deszka.
 *
 * Élesben mért (aquamarina.com/products/nuts/): „Our NUTS board is the perfect
 * **all-around board** for first-time paddlers…". Az ilyen deszkáknál a
 * használat-értékelés más készletet mutat (TRACKING/STABILITY), tehát a sávok
 * nem segítenek — a próza viszont egyértelmű.
 *
 * SZIGORÚ MINTA: a kategória-szó után KÖTELEZŐ a „board"/„sup"/„isup" —
 * enélkül a navigáció kategória-menüje („ALL-AROUND", „RACE") minden oldalon
 * hamis találatot adna. Élesben mérve ez a különbség dönt.
 *
 * Több, ELTÉRŐ kategória említésénél `null` — nem tippelünk.
 *
 * AZ ALLROUND SZINONIMÁI (2026-08-21, gladiatorsup.com): a gyártók ritkán
 * írják le, hogy „all-around board" — helyette azt mondják, hogy „versatile",
 * „universal", „entry-level". Mérve ugyanazon a márkán:
 *
 *   ELITE 12.6T  „The **touring** SUP board from the Elite series"   → túra
 *   ELITE 11.6   „The **universal** SUP board from the Elite series" → allround
 *   PRO 11.6     „a **versatile** SUP board from the Pro series"     → allround
 *   ORIGIN 10.6  „a versatile model from the **entry-level** series" → allround
 *
 * MIÉRT FONTOS ez a négy szó: enélkül csak a 12.6T kapott kategóriát, a többi
 * üresen maradt — és a családi öröklés az EGYETLEN „touring" tagtól az egész
 * `Elite`/`Pro`/`Origin` vonalat túrásnak jelölte volna. Azok viszont KIVITELI
 * vonalak, nem használati kategóriák: egy családon belül van túra- és
 * allround-deszka is. A gyártó saját szavai ezt eldöntik, a családnév nem.
 *
 * A SZIGORÚ MINTA ITT IS ÁLL: a szó után kötelező a „board"/„model"/„sup"/
 * „isup", különben egy „versatile bag" vagy „universal fin" is besorolna egy
 * deszkát. A „model" azért került be, mert a gyártó így is fogalmaz:
 * „a versatile **model** from the entry-level Origin series" — navigációs
 * menüben ez az alak nem fordul elő, prózában igen.
 */
export function boardTypeFromDescription(text: string): BoardType | null {
  const rules: [RegExp, BoardType][] = [
    [/\ball[\s-]*(?:a|)round\s+(?:i?sup\s+)?(?:board|model)\b/i, "allround"],
    [/\b(?:versatile|universal|all[\s-]*purpose)\s+(?:i?sup\s+)?(?:board|model)\b/i, "allround"],
    [/\bentry[\s-]*level\s+(?:i?sup\s+)?(?:board|model)\b/i, "allround"],
    [/\btouring\s+(?:i?sup\s+)?(?:board|model)\b/i, "touring"],
    [/\brace\s+(?:i?sup\s+)?(?:board|model)\b/i, "race"],
    [/\b(?:yoga|fitness)\s+(?:i?sup\s+)?(?:board|model)\b/i, "yoga"],
    [/\bfishing\s+(?:i?sup\s+)?(?:board|model)\b/i, "fishing"],
    [/\b(?:river|whitewater)\s+(?:i?sup\s+)?(?:board|model)\b/i, "river"],
  ];
  const found = new Set<BoardType>();
  for (const [pattern, type] of rules) {
    if (pattern.test(text)) found.add(type);
  }
  return found.size === 1 ? [...found][0]! : null;
}

/**
 * Termékkép a gyártói oldalról (F2.1-utó-24, 2026-08-20).
 *
 * MIÉRT KELL: a felhasználók sokszor KÉP alapján döntenek, a JSON-LD nélküli
 * oldalakon viszont nincs `og:image` sem (élesben: aquamarina.com), és az
 * oldalon 30+ `<img>` van — köztük a fejléc-logók.
 *
 * A HORGONY A MODELLKÓD, MAJD A MODELLNÉV: a gyártó a fájlnévbe írja
 * (`AQUA-MARINA-SUP-BLAZE-BT-26BZ-Ghost-White-222x1024.png`), a spec-blokk
 * pedig kiírja („MODEL: BT-26BZ"). Így termék-specifikus a találat, nem
 * „az oldal első képe" — utóbbi a logót adná.
 *
 * A MÉRET-UTÓTAG LEVÁGVA: a WordPress `-222x1024` alakú bélyegképeket készít;
 * enélkül egy apró, torzított kép kerülne a katalógusba.
 *
 * ELŐNYBEN A FRONT/BACK RENDER (2026-08-20): ha ugyanarra a horgonyra több kép
 * is illeszkedik, a `…-front-back.png` alakút választjuk. Ez nem szépészeti
 * kérdés: a katalógusban a képek EGYMÁS MELLETT jelennek meg, és a
 * véleményezőnek el kell igazodnia köztük — a fehér hátterű, azonos beállítású
 * gyártói render összehasonlítható, az életkép (drónfotó, vízen evező ember)
 * nem. Élesben ez a Nuts, a Race Elite és a Rapid képét cserélte életképről
 * renderre.
 *
 * POZÍCIÓ-FALLBACK: ha EGYETLEN horgony sem talál, az oldal első nem-kizárt
 * képét vesszük. Miért szabad ez? Mert a fájlnév ezen a gyártói oldalon NEM
 * megbízható, a pozíció viszont az: a `/fitness/peace/` oldal hero-képe
 * `YOGA-DOCK-1.png` néven fut, a `/fitness/dock/` oldalé `peace.png` néven —
 * a két fájlnév FEL VAN CSERÉLVE, miközben mindkét oldalon a helyes termék
 * látszik (megnéztük a képeket). 49 gyártói oldalon mérve: ahol mindkét
 * szabály adott képet, 30-szor UGYANAZT; a fallback pontosan ott szólal meg,
 * ahol a horgony néma (elgépelt vagy felcserélt fájlnév).
 */
export function findProductImage(html: string, ...anchors: (string | null)[]): string | null {
  const images = [...html.matchAll(/<img\s[^>]*>/gi)]
    .map((m) => parseImgTag(m[0]))
    .filter((image): image is PageImage => image !== null)
    // Kizárt fájlnevek: a fejléc-logó, illetve a RÉSZLET-/technológia-képek
    // (élesben a Coralnál a „construction-CORAL-Raspberry" nyert volna a
    // termék fő fotója helyett). Ezek nem alkalmasak katalógus-képnek.
    .filter(
      (image) => !/logo|construction|technology|detail|icon|thumb|badge/i.test(fileOf(image.src)),
    );

  const needles = anchors
    .map((a) => (a ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase())
    .filter((n) => n.length >= 3);

  // A horgonyok SORRENDBEN: a cikkszám pontosabb, a modellnév általánosabb.
  for (const needle of needles) {
    const matches = images.filter((image) => normalizeFile(image.src).includes(needle));
    const best = matches.find((image) => isRenderFile(fileOf(image.src))) ?? matches[0];
    if (best !== undefined) return displayVariant(best);
  }

  return images[0] === undefined ? null : displayVariant(images[0]);
}

interface PageImage {
  src: string;
  /** A gyártó SAJÁT méret-változatai (`… 679w, … 2762w`), ha kitette. */
  srcset: string | null;
}

function parseImgTag(tag: string): PageImage | null {
  const src = tag.match(/\ssrc="([^"]+)"/i)?.[1];
  if (src === undefined || src.trim() === "") return null;
  return { src, srcset: tag.match(/\ssrcset="([^"]+)"/i)?.[1] ?? null };
}

/**
 * A fájlnév a KÉT NÉZETES gyártói rendert jelöli-e? Ugyanaz a fogalom többféle
 * néven: `front-back` (Aqua Marina), `Top_Bottom` (Fanatic). Ezek fehér
 * hátterű, azonos beállítású képek — a katalógusban EGYMÁS MELLETT
 * összevethetők, az életkép nem.
 *
 * Élesben: a Fanatic Viper Air képe enélkül a `Gallery02.jpg` lett volna —
 * egy vitorlás felszerelés a vízen, nem a deszka.
 */
function isRenderFile(file: string): boolean {
  return /front[_-]?back|top[_-]?bottom/i.test(file);
}

function fileOf(src: string): string {
  return src.split("/").pop() ?? "";
}

function normalizeFile(src: string): string {
  return fileOf(src).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/**
 * MEGJELENÍTÉSRE VALÓ méret-változat — mobil-first alkalmazásban ez nem
 * apróság.
 *
 * ÉLESBEN MÉRT KÁR (2026-08-20): az eredeti szabály a WordPress méret-utótagot
 * levágta, hogy „ne egy apró változat" kerüljön be — csakhogy ezzel a
 * SZERKESZTŐSÉGI EREDETIT választotta. A katalógus képei így átlagosan 680 kB-ot
 * nyomtak, a legrosszabb (Aqua Marina Cascade) **8,9 MB**-ot; egy 20 kártyás
 * lista ~13 MB mobiladat lett volna.
 *
 * A gyártó viszont maga kirakja a méret-változatokat a `srcset`-ben. Onnan a
 * legkisebb olyat vesszük, ami még bőven elég a legnagyobb megjelenítéshez
 * (adatlap-hero ~700 CSS px, 2× kijelzőn is fedve) — a Cascade így 8904 kB
 * helyett 613 kB. Ha nincs `srcset`, marad a régi utótag-levágás: ott a `src`
 * gyakran épp egy pici bélyegkép.
 */
const DISPLAY_TARGET_WIDTH = 700;

function displayVariant(image: PageImage): string {
  const entries = parseSrcset(image.srcset);
  if (entries.length === 0) return fullSize(image.src);
  const enough = entries
    .filter((entry) => entry.width >= DISPLAY_TARGET_WIDTH)
    .sort((a, b) => a.width - b.width)[0];
  // Ha egyik változat sem éri el a célt, a LEGNAGYOBB elérhető a legjobb.
  const largest = entries.reduce((a, b) => (b.width > a.width ? b : a));
  return (enough ?? largest).url;
}

function parseSrcset(srcset: string | null): { url: string; width: number }[] {
  if (srcset === null) return [];
  const entries: { url: string; width: number }[] = [];
  for (const part of srcset.split(",")) {
    const match = part.trim().match(/^(\S+)\s+(\d+)w$/);
    if (match) entries.push({ url: match[1] as string, width: Number(match[2]) });
  }
  return entries;
}

/** `-222x1024.png` → `.png` — csak `srcset` HIÁNYÁBAN (ld. `displayVariant`). */
function fullSize(src: string): string {
  return src.replace(/-\d{2,4}x\d{2,4}(?=\.[a-z]{3,4}(?:$|\?))/i, "");
}

/**
 * A gyártó cikkszáma a spec-blokkból („MODEL: BT-26BZ"). Ez a horgony a
 * termékkép megtalálásához — és önmagában is azonosít.
 */
export function findModelCode(pageText: string): string | null {
  const match = pageText.match(/\bMODEL\b\s*\n?\s*([A-Z]{2}[A-Z0-9-]{3,20})\b/);
  return match?.[1] ?? null;
}

/**
 * Kategória a gyártó SAJÁT KATEGÓRIA-FELIRATÁBÓL, a felirat SORRENDJE szerint.
 *
 * Élesben (fanatic.com) a termékfejlécben ez áll:
 *   Viper Air → „ALL-AROUND / WINDSURF"
 *   Ray Air   → „TOURING / FREERACING"
 *
 * A SORREND SZÁMÍT, és ezért nem használható a szokásos `guessBoardType`: az a
 * saját szabály-prioritása szerint dönt, és a Ray Airnél a „FREERACING"-ből
 * race-t adna a valós túra helyett. A gyártó viszont az ELSŐ helyre a fő
 * felhasználást írja — azt vesszük.
 */
export function boardTypeFromCategoryLine(text: string): BoardType | null {
  // Helyi hajtás: a `normalize.ts`-ből importálni körkörös függést adna
  // (az importálja EZT a modult).
  const folded = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const rules: [BoardType, string[]][] = [
    ["kids", ["kids", "junior", "youth"]],
    ["fishing", ["fishing", "angler"]],
    ["river", ["river", "whitewater", "rapid"]],
    ["race", ["race", "racing"]],
    ["yoga", ["yoga", "fitness", "pilates"]],
    ["touring", ["touring", "tura", "explore", "adventure"]],
    ["allround", ["all-around", "all around", "allround", "all-round", "all round"]],
  ];
  let best: { at: number; type: BoardType } | null = null;
  for (const [type, needles] of rules) {
    for (const needle of needles) {
      const at = folded.indexOf(needle);
      if (at < 0) continue;
      if (best === null || at < best.at) best = { at, type };
    }
  }
  return best?.type ?? null;
}

/**
 * A kategória-felirat MINDEN tagja, a felirat sorrendjében (F2.1-utó-41).
 *
 * MIÉRT: a gyártó KETTŐT mond (`ALL-AROUND / WINDSURF`,
 * `TOURING / FREERACING`), és eddig a második felét eldobtuk. Ez volt az
 * egyik olyan hely, ahol a MI adatmodellünk vesztett el gyártói információt —
 * nem a forrás hallgatott.
 *
 * A sorrend a feliraté marad: az első tag ugyanaz, amit a
 * `boardTypeFromCategoryLine` ad, tehát az egyértékű ág változatlan.
 */
export function boardTypesFromCategoryLine(text: string): BoardType[] {
  const folded = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const rules: [BoardType, string[]][] = [
    ["kids", ["kids", "junior", "youth"]],
    ["fishing", ["fishing", "angler"]],
    ["river", ["river", "whitewater", "rapid"]],
    ["race", ["race", "racing"]],
    ["yoga", ["yoga", "fitness", "pilates"]],
    ["touring", ["touring", "tura", "explore", "adventure"]],
    ["allround", ["all-around", "all around", "allround", "all-round", "all round"]],
  ];
  const found: { at: number; type: BoardType }[] = [];
  for (const [type, needles] of rules) {
    let earliest: number | null = null;
    for (const needle of needles) {
      const at = folded.indexOf(needle);
      if (at >= 0 && (earliest === null || at < earliest)) earliest = at;
    }
    if (earliest !== null) found.push({ at: earliest, type });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.type);
}
