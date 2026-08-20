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
 */
export function boardTypeFromDescription(text: string): BoardType | null {
  const rules: [RegExp, BoardType][] = [
    [/\ball[\s-]*(?:a|)round\s+(?:i?sup\s+)?board\b/i, "allround"],
    [/\btouring\s+(?:i?sup\s+)?board\b/i, "touring"],
    [/\brace\s+(?:i?sup\s+)?board\b/i, "race"],
    [/\b(?:yoga|fitness)\s+(?:i?sup\s+)?board\b/i, "yoga"],
    [/\bfishing\s+(?:i?sup\s+)?board\b/i, "fishing"],
    [/\b(?:river|whitewater)\s+(?:i?sup\s+)?board\b/i, "river"],
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
  const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)]
    .map((m) => m[1] ?? "")
    // Kizárt fájlnevek: a fejléc-logó, illetve a RÉSZLET-/technológia-képek
    // (élesben a Coralnál a „construction-CORAL-Raspberry" nyert volna a
    // termék fő fotója helyett). Ezek nem alkalmasak katalógus-képnek.
    .filter((src) => !/logo|construction|technology|detail|icon|thumb|badge/i.test(fileOf(src)));

  const needles = anchors
    .map((a) => (a ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase())
    .filter((n) => n.length >= 3);

  // A horgonyok SORRENDBEN: a cikkszám pontosabb, a modellnév általánosabb.
  for (const needle of needles) {
    const matches = images.filter((src) => normalizeFile(src).includes(needle));
    const best = matches.find((src) => /front[_-]?back/i.test(fileOf(src))) ?? matches[0];
    if (best !== undefined) return fullSize(best);
  }

  return images[0] === undefined ? null : fullSize(images[0]);
}

function fileOf(src: string): string {
  return src.split("/").pop() ?? "";
}

function normalizeFile(src: string): string {
  return fileOf(src).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/** `-222x1024.png` → `.png` (a WordPress bélyegkép helyett az eredeti). */
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
