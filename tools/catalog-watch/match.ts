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

/**
 * Amit egy jelöltről az egyeztetéshez ismerni kell. A `specs` azért van itt,
 * mert a SZERKEZET (felfújható kontra kemény) kizáró jel — ld.
 * `constructionConflicts`.
 */
export type MatchCandidate = Pick<
  ExtractedProduct,
  "brandName" | "modelName" | "modelYear"
> & {
  /**
   * Elhagyható: ahol a hívó nem ismeri a szerkezetet, ott nincs mit kizárni.
   * A `crawl.ts` és a jóváhagyó teljes `ExtractedProduct`-ot ad, tehát élesben
   * mindig van.
   */
  specs?: { inflatable: boolean | null };
};

/**
 * KIZÁRÓ ELTÉRÉS: a jelölt és a deszka SZERKEZETE mond ellent egymásnak.
 *
 * Élesben (boteboard.com, 2026-08-29) a márka ugyanazt a modellcsaládot
 * felfújható („Rackham Aero") és kemény („Rackham Gatorshell") kivitelben is
 * árulja. A nevek trigram-hasonlósága emiatt magas: mind a hat kemény deszkát
 * a felfújható testvérére javasolta összevonásra a rendszer — a
 * „HD Gatorshell 10'6\""-t ráadásul a „Breeze Aero 10'6\""-ra, tehát még a
 * modellcsalád is más volt. A moderátori sor helyesen elkapta őket, de hat
 * hamis összevonási javaslat maradt volna benne.
 *
 * Ez NEM küszöb-hangolás: két deszka, amiről a forrás egyiknél felfújhatót,
 * másiknál keményet állít, sosem lehet ugyanaz a katalógus-sor (más a
 * szerkezete, a súlya és a vastagsága). A kizárás ezért KEMÉNY, de csak akkor
 * él, ha MINDKÉT oldal állít valamit — `null` mellett nem zárunk ki semmit.
 */
export function constructionConflicts(
  candidate: MatchCandidate,
  board: BoardForMatch,
): boolean {
  const a = candidate.specs?.inflatable ?? null;
  const b = board.inflatable;
  return a !== null && b !== null && a !== b;
}

/**
 * KIZÁRÓ ELTÉRÉS: a két név MÁS MÉRETET mond.
 *
 * ÉLESBEN MÉRT HIBA (star-board.com, 2026-09-21): a
 * `Hyper Nut 7'4" X 30" Limited Series` jelölt a
 * `Whopper 9'0" x 33" Limited Series` deszkára kapott összevonási javaslatot,
 * 0,57-es bizalommal. Két teljesen más modell — a hasonlóságot a KÖZÖS
 * KIVITEL-utótag („Limited Series") és az azonos méret-FORMÁTUM húzta fel, nem
 * a modellnév. Egy kattintás az „Összefésülés"-en, és a Hyper Nut beleolvadt
 * volna a Whopperbe.
 *
 * A SUP-nál a MÉRET maga a termék (a Deszkaválasztó hosszra és szélességre
 * pontoz), ezért ez nem küszöb-hangolás: két deszka, amelyik más méretet visel
 * a nevében, sosem lehet ugyanaz a katalógus-sor. A kizárás KEMÉNY, de csak
 * akkor él, ha MINDKÉT név hordoz méretet — méret nélküli névnél nincs mit
 * összevetni (a gyártók fele nem teszi a névbe).
 */
export function sizeConflicts(candidateName: string, boardName: string): boolean {
  const a = sizeToken(candidateName);
  const b = sizeToken(boardName);
  return a !== null && b !== null && a !== b;
}

/**
 * A névben álló méret normalizált alakja (`10'0" X 34"` → `10'0x34`), vagy
 * `null`, ha a név nem mond méretet. A hüvelyk- és lábjelek, a szóközök és a
 * kis/nagybetű nem különböztet meg — a gyártók írásmódja következetlen
 * (`10'0" X 34"`, `10'0" x 34"`, `10'10'' -- X2`).
 */
function sizeToken(name: string): string | null {
  const match = name.match(/(\d+)\s*'\s*(\d*)\s*["'\u2019\u201d]*\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return `${match[1]}'${match[2] || "0"}x${(match[3] ?? "").replace(",", ".")}`;
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
  candidate: MatchCandidate,
  boards: readonly BoardForMatch[],
): MatchResult {
  let best: { board: BoardForMatch; score: number; brandScore: number } | null = null;

  for (const board of boards) {
    if (constructionConflicts(candidate, board)) continue;
    if (sizeConflicts(candidate.modelName, board.modelName)) continue;
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

/** Egy jelölt sorsa a TÖMEGES jóváhagyásban. */
export type ApprovalPlan =
  | { kind: "merge"; boardId: string; confidence: number }
  | { kind: "moderator"; boardId: string; confidence: number }
  | { kind: "create"; confidence: number };

/**
 * ÚJRA-EGYEZTETÉS a MOSTANI katalógussal, a tömeges jóváhagyás előtt.
 *
 * MIÉRT KELL (élesben mért kockázat, 2026-08-20): a jelölt sora a crawl
 * pillanatában megfagy, benne az AKKORI egyeztetés eredményével. A bolti
 * jelöltek java KORÁBBAN keletkezett, mint a hozzájuk tartozó gyártói deszka,
 * ezért `matched_board_id` nélkül várakoznak — a jóváhagyó pedig „új típusnak"
 * látta őket. Így került volna a katalógusba egy második ATLAS, BEAST, HYPER,
 * RAPID és Dhyana, ráadásul bolti néven („MAGMA 11'2" 23%").
 *
 * A `matchCandidate` három kimenete háromféle sorsot kap:
 *  * `known`     → **merge**: a deszka már megvan, új sor nem születik,
 *  * `uncertain` → **moderator**: a bizonytalan egyezés EMBERI döntés; a
 *    jelölt marad `pending` (inkább maradjon a sorban, mint hogy tévedjünk),
 *  * `new`       → **create**: tényleg új típus.
 */
export function planApproval(
  candidate: MatchCandidate,
  boards: readonly BoardForMatch[],
): ApprovalPlan {
  const match = matchCandidate(candidate, boards);
  if (match.kind === "known" && match.boardId !== null) {
    return { kind: "merge", boardId: match.boardId, confidence: match.confidence };
  }
  if (match.kind === "uncertain" && match.boardId !== null) {
    return { kind: "moderator", boardId: match.boardId, confidence: match.confidence };
  }
  return { kind: "create", confidence: match.confidence };
}
