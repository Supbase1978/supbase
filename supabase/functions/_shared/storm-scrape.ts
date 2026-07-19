/**
 * Tavi viharjelzés-scraper — parse-logika (9. fejezet pipeline 1. lépése).
 *
 * FORRÁS (élőben verifikálva, 2026-07-19): a tavi viharjelzést a HungaroMet
 * (volt OMSZ) adja ki, TAVANKÉNTI tartalom-oldalakon (`.../viharjelzes/main.php`),
 * tiszta szöveges jelzéssel („A Tisza tavon elsőfokú viharjelzés érvényes.") és
 * fokozat-képpel (`/images/elemek/viharjelzesN.png`). A Balaton-oldal
 * medencénként ad mondatot — körzet-szinten a LEGMAGASABB fokozat számít.
 * A Fertőre a HungaroMet NEM ad oldalt (más üzemeltető) — az F1-ben forrás
 * nélkül marad: unknown → az utolsó ismert szint él tovább (fail-safe).
 *
 * A parser SZÖVEG-alapú és tag-toleráns (HTML-átrendezésre nem törik), a
 * fokozat-kép másodlagos jel: szöveg–kép eltérésnél a MAGASABB fokozat győz
 * (fail-safe felfelé).
 *
 * FONTOS (2. fejezet 5. szabály): cache-elt viharjelzés SOHA nem jelenhet meg
 * aktuálisként — a snapshot fetched_at-ja a scrape pillanata; a régiséget a
 * felhasználói réteg a szokásos 30 perces stale-küszöbbel kezeli.
 */
import type { StormLevel } from "./types.ts";

/** Egy viharjelzési körzet forrás-oldala. */
export interface StormSource {
  /** Kanonikus körzetnév (== spots.storm_warning_region seed-érték). */
  region: string;
  /** A körzet tartalom-oldala (met.hu tavankénti main.php). */
  url: string;
}

/**
 * Default forrás-lista (env-ből felülírható: STORM_SOURCES JSON). A Fertő
 * szándékosan hiányzik: nincs HungaroMet-forrása (F1-korlát, README).
 */
export const DEFAULT_STORM_SOURCES: readonly StormSource[] = [
  {
    region: "Balaton",
    url: "https://www.met.hu/idojaras/tavaink/balaton/viharjelzes/main.php",
  },
  {
    region: "Velencei-tó",
    url: "https://www.met.hu/idojaras/tavaink/velencei-to/viharjelzes/main.php",
  },
  {
    region: "Tisza-tó",
    url: "https://www.met.hu/idojaras/tavaink/tisza-to/viharjelzes/main.php",
  },
];

/**
 * A viharjelzési körzetek kanonikus nevei (== spots.storm_warning_region seed).
 * Minden körzethez a forrásoldalon előforduló, kisbetűsített keresési változatok.
 */
export const STORM_REGIONS = [
  { region: "Balaton", needles: ["balaton"] },
  { region: "Velencei-tó", needles: ["velencei"] },
  { region: "Tisza-tó", needles: ["tisza-tó", "tisza tó", "tisza-tavi", "tisza-to"] },
  { region: "Fertő", needles: ["fertő", "ferto"] },
] as const satisfies readonly { region: string; needles: readonly string[] }[];

/** Egy körzet detektált szintváltása (a push-pipeline bemenete, 9./2.). */
export interface StormLevelChange {
  region: string;
  from: StormLevel;
  to: StormLevel;
}

/** HTML → sallangmentes, kisbetűs szöveg (tag-eltávolítás + whitespace-normalizálás). */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/** detectLevel háromállapotú kimenete: viharfok VAGY "unknown" (nincs megerősítés). */
export type DetectedLevel = StormLevel | "unknown";

/** Fokozat-minták. A II. fokot MINDIG az I. előtt vizsgáljuk ("i. fok" az "ii. fok" részszövege). */
const LEVEL2_NEEDLES = [
  "másodfok",
  "masodfok",
  "ii. fok",
  "ii.fok",
  "ii fok",
  "vészjelz",
  "veszjelz",
];
const LEVEL1_NEEDLES = [
  "elsőfok",
  "elsofok",
  "i. fok",
  "i.fok",
  "i fok",
  "előkészítő jelz",
  "elokeszito jelz",
];

/**
 * POZITÍV "nincs jelzés" megerősítés — leminősítéshez (→ 0) KELL. Kontiguus
 * minták, hogy a "nincs másodfokú viharjelzés" (ami NEM jelent nulla fokot) NE
 * essen ide. Csak explicit "nincs viharjelzés" / "viharjelzés megszűnt/feloldva".
 */
const NO_WARNING_PATTERNS = [
  // met.hu tavankénti oldal 0-s állapota (élőben megfigyelt szöveg):
  // "A Tisza tavon a viharjelző rendszer alapon van."
  "viharjelző rendszer alapon",
  "viharjelzo rendszer alapon",
  "nincs viharjelz",
  "nincs érvényben",
  "nincs ervenyben",
  "nincs figyelmeztet",
  "viharjelzés megszűnt",
  "viharjelzes megszunt",
  "viharjelzés feloldva",
  "viharjelzes feloldva",
  "viharjelzés nincs",
  "viharjelzes nincs",
  "jelzés megszűnt",
  "jelzes megszunt",
];

/** Tagadó tokenek, amelyek egy fokozat-találatot ÉRVÉNYTELENÍTENEK, ha előtte állnak. */
const NEGATION_TOKENS = [
  "nincs",
  "nem ",
  "megszűnt",
  "megszunt",
  "megszűn",
  "megszun",
  "feloldva",
  "visszavonva",
];
/** Tagadó token keresési ablaka a fokozat-minta ELŐTT (karakter). */
const NEG_LOOKBACK = 12;

function hasNegationBefore(text: string, matchIdx: number): boolean {
  const pre = text.slice(Math.max(0, matchIdx - NEG_LOOKBACK), matchIdx);
  return NEGATION_TOKENS.some((tok) => pre.includes(tok));
}

/** Van-e TAGADÁS NÉLKÜLI fokozat-találat a szövegben a megadott needle-ekre. */
function hasNonNegatedMatch(text: string, needles: readonly string[]): boolean {
  for (const needle of needles) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(needle, from);
      if (i === -1) break;
      if (!hasNegationBefore(text, i)) return true;
      from = i + needle.length;
    }
  }
  return false;
}

/**
 * Egy szövegablakból a viharfok kiolvasása — TAGADÁS-TUDATOSAN (M1, biztonság).
 * A 0-t (leminősítés) CSAK pozitív "nincs jelzés"-megerősítésre adjuk; tagadott
 * fokozat-találat (pl. "nincs másodfokú...") nem érvényes; ha se pozitív fokozat,
 * se pozitív "nincs jelzés" → "unknown" (a hívó megtartja az utolsó ismert szintet,
 * így egy érvényes II. fok nem minősül le hamisan menü-/footer-találatra).
 */
export function detectLevel(window: string): DetectedLevel {
  if (hasNonNegatedMatch(window, LEVEL2_NEEDLES)) return 2;
  if (hasNonNegatedMatch(window, LEVEL1_NEEDLES)) return 1;
  if (NO_WARNING_PATTERNS.some((p) => window.includes(p))) return 0;
  return "unknown";
}

/**
 * Fokozat-kép mint MÁSODLAGOS jel: a met.hu tavankénti oldalain a jelzést a
 * `/images/elemek/viharjelzesN.png` ikon (is) hordozza, ahol N a fokozat (0/1/2).
 * A nyers HTML-en fut (a stripHtml az img tageket eldobná). Több találatnál
 * (Balaton-medencék) a legmagasabb számít.
 */
export function detectImageLevel(html: string): DetectedLevel {
  let max: DetectedLevel = "unknown";
  for (const m of html.matchAll(/viharjelzes(\d)\.(?:png|gif|jpe?g)/gi)) {
    const n = Number(m[1]);
    const level: StormLevel = n >= 2 ? 2 : n === 1 ? 1 : 0;
    if (max === "unknown" || level > max) max = level;
  }
  return max;
}

/**
 * Egy KÖRZETI forrás-oldal (tavankénti main.php) fokozata. Szöveg-jel
 * (detectLevel a teljes oldal-szövegen: több medence-mondatnál a II. fok
 * needle-jei elsőbbséget élveznek → maximum-szemantika) + kép-jel
 * (detectImageLevel); eltérésnél a MAGASABB győz (fail-safe felfelé).
 * Ha egyik jel sincs → unknown (a hívó az utolsó ismert szintet tartja).
 */
export function detectPageLevel(html: string): DetectedLevel {
  const textLevel = detectLevel(stripHtml(html));
  const imageLevel = detectImageLevel(html);
  if (textLevel === "unknown") return imageLevel;
  if (imageLevel === "unknown") return textLevel;
  return Math.max(textLevel, imageLevel) as StormLevel;
}

/**
 * A körzetnév utáni szövegablak felső korlátja (karakter). A fokozat a körzetnév
 * UTÁN jelenik meg (táblázatsor / kártya); az ablakot ezen felül a KÖVETKEZŐ
 * körzet kezdete is zárja, hogy egy szomszédos sor fokozata ne szivárogjon át.
 */
const WINDOW_CHARS = 160;

/** Egy körzet ELSŐ előfordulási indexe a normalizált szövegben (−1, ha nincs). */
function firstIndexOf(text: string, needles: readonly string[]): number {
  let idx = -1;
  for (const needle of needles) {
    const found = text.indexOf(needle);
    if (found !== -1 && (idx === -1 || found < idx)) idx = found;
  }
  return idx;
}

/**
 * Viharjelzés-HTML → körzetenkénti szint. Az ablak a körzetnévtől a KÖVETKEZŐ
 * (bármely) körzet előfordulásáig tart (max. WINDOW_CHARS), így egy szomszédos
 * sor magasabb fokozata nem szennyezi be a körzetet. Hiányzó körzet nem kerül a
 * Map-be (a hívó ilyenkor a legutóbbi ismert szintet tartja meg — konzervatív).
 */
export function parseStormWarnings(html: string): Map<string, StormLevel> {
  const text = stripHtml(html);
  const result = new Map<string, StormLevel>();

  const positions = STORM_REGIONS.map(({ region, needles }) => ({
    region,
    idx: firstIndexOf(text, needles),
  })).filter((p) => p.idx !== -1);

  for (const { region, idx } of positions) {
    // Ablak-vég: a következő körzet kezdete (bármelyik), ha közelebb van, mint a cap.
    let end = idx + WINDOW_CHARS;
    for (const other of positions) {
      if (other.idx > idx && other.idx < end) end = other.idx;
    }
    const level = detectLevel(text.slice(idx, end));
    // "unknown" NEM kerül a Map-be: a hívó megtartja az utolsó ismert szintet
    // (leminősítéshez pozitív megerősítés kell — biztonságkritikus, M1).
    if (level !== "unknown") result.set(region, level);
  }

  return result;
}

/**
 * Szintváltás-detektálás körzetenként. A `previous` a legutóbbi ismert szint
 * (weather_snapshots-ból), a `current` a friss scrape. Csak a TÉNYLEGES váltások
 * (from !== to) kerülnek a kimenetbe; a stabil és a hiányzó (current-ből kimaradt)
 * körzeteket kihagyjuk. Az iteráció a STORM_REGIONS sorrendjében determinisztikus.
 */
export function detectStormLevelChanges(
  previous: ReadonlyMap<string, StormLevel>,
  current: ReadonlyMap<string, StormLevel>,
): StormLevelChange[] {
  const changes: StormLevelChange[] = [];
  for (const { region } of STORM_REGIONS) {
    const to = current.get(region);
    if (to === undefined) continue;
    const from = previous.get(region) ?? 0;
    if (from !== to) changes.push({ region, from, to });
  }
  return changes;
}
