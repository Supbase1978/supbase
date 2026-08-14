/**
 * catalog-watch — egyezés-keresés és dedup (terv 3. pont, „az admin-jóváhagyás
 * magja").
 *
 * A hasonlóság a PostgreSQL `pg_trgm`-jével AZONOS algoritmus, JS-ben — a
 * `trigrams`/`similarity` primitíveket a `@core/text/similarity` adja
 * (F2.1-utó-8: az admin duplikátum-gyanú funkciónak is kellett, a
 * modul-szerződés szerint a közös igény a core-ba került, ugyanaz a minta,
 * mint a `slugify`-nál, ld. `src/core/text/slug.ts`). **Relatív import, NEM
 * a `@core/*` alias** — ez a fájl sima `node`-dal fut (a CLI-n és a heti
 * cronon át), nem a Vite-bundleren keresztül, ahol az alias feloldódna.
 *
 * Miért nem a DB-ben dől el a hasonlóság?
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
import { similarity, trigrams } from "../../src/core/text/similarity.ts";

export { similarity, trigrams };

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
