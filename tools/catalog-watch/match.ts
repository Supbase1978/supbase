/**
 * catalog-watch — egyezés-keresés és dedup (terv 3. pont, „az admin-jóváhagyás
 * magja").
 *
 * A hasonlóság a PostgreSQL `pg_trgm`-jével AZONOS algoritmus, JS-ben: a
 * szavakat két szóközzel elöl és eggyel hátul kipárnázva trigramokra bontjuk,
 * és a halmazok Jaccard-hányadosát vesszük. Miért nem a DB-ben?
 *   * a döntés így TISZTA függvény → táblázatos határeset-tesztekkel védhető,
 *   * a katalógus mérete (száz nagyságrend) mellett a teljes lista beolvasása
 *     olcsóbb, mint jelöltenként egy RPC-kör.
 * A migráció trigram GIN indexe megmarad: nagyobb katalógusnál a DB-oldali
 * előszűrés bekapcsolható anélkül, hogy a döntési logika változna.
 *
 * A KÜSZÖBÖK KONZERVATÍVAK: bizonytalanságnál inkább moderációs sorba kerül a
 * jelölt, mint hogy két különböző modell összeolvadjon. A dupla-név elleni
 * védelem az admin-jóváhagyás — a figyelő soha nem publikál magától.
 */
import type { BoardForMatch, ExtractedProduct, MatchResult } from "./types.ts";
import { foldText } from "./normalize.ts";

/** Efölött ismertnek vesszük a deszkát: ársor + last_seen_at, jelölt nélkül. */
export const KNOWN_THRESHOLD = 0.8;
/** Efölött „bizonytalan egyezés": jelölt sor a javasolt párral (merge-döntés). */
export const UNCERTAIN_THRESHOLD = 0.45;
/** A márkának is illeszkednie kell a biztos találathoz. */
export const BRAND_THRESHOLD = 0.8;

/** A modellnév súlya a márkával szemben (a márka önmagában sok modellre illik). */
const MODEL_WEIGHT = 0.65;
const BRAND_WEIGHT = 0.35;
/** Eltérő évjárat: ugyanaz a modell, de másik verzió — enyhe rontás. */
const YEAR_MISMATCH_FACTOR = 0.9;

/**
 * `pg_trgm`-kompatibilis trigram-halmaz: kisbetűs, ékezet-hajtott szavak,
 * szavanként `"  szó "` párnázással.
 */
export function trigrams(text: string): Set<string> {
  const set = new Set<string>();
  const words = foldText(text)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "");

  for (const word of words) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) {
      set.add(padded.slice(i, i + 3));
    }
  }
  return set;
}

/** Jaccard-hasonlóság két trigram-halmazon (0–1). Üres bemenet → 0. */
export function similarity(a: string, b: string): number {
  const setA = trigrams(a);
  const setB = trigrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const gram of setA) if (setB.has(gram)) shared += 1;
  const union = setA.size + setB.size - shared;
  return union === 0 ? 0 : round3(shared / union);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Egy jelölt–deszka pár összesített pontszáma (0–1). */
export function scorePair(
  candidate: Pick<ExtractedProduct, "brandName" | "modelName" | "modelYear">,
  board: BoardForMatch,
): { score: number; brandScore: number; modelScore: number } {
  const brandScore =
    candidate.brandName && board.brandName
      ? similarity(candidate.brandName, board.brandName)
      : 0;
  const modelScore = similarity(candidate.modelName, board.modelName);

  let score = brandScore * BRAND_WEIGHT + modelScore * MODEL_WEIGHT;
  if (
    candidate.modelYear !== null &&
    board.modelYear !== null &&
    candidate.modelYear !== board.modelYear
  ) {
    score *= YEAR_MISMATCH_FACTOR;
  }
  return { score: round3(score), brandScore, modelScore };
}

/**
 * A jelölt besorolása a terv három kimenetére.
 *
 * `known` — magas összpontszám ÉS illeszkedő márka. A márka-feltétel azért
 * kemény, mert két gyártó ugyanazt a modellnevet is használhatja („Explorer"),
 * és egy téves összeolvasztás rossz árat írna a másik deszkára.
 */
export function matchCandidate(
  candidate: Pick<ExtractedProduct, "brandName" | "modelName" | "modelYear">,
  boards: readonly BoardForMatch[],
): MatchResult {
  let best: { board: BoardForMatch; score: number; brandScore: number } | null = null;

  for (const board of boards) {
    const { score, brandScore } = scorePair(candidate, board);
    if (!best || score > best.score) best = { board, score, brandScore };
  }

  if (!best || best.score < UNCERTAIN_THRESHOLD) {
    return { kind: "new", boardId: null, confidence: best?.score ?? 0 };
  }
  if (best.score >= KNOWN_THRESHOLD && best.brandScore >= BRAND_THRESHOLD) {
    return { kind: "known", boardId: best.board.id, confidence: best.score };
  }
  return { kind: "uncertain", boardId: best.board.id, confidence: best.score };
}
