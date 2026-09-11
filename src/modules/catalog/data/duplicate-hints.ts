/**
 * Jelölt↔jelölt duplikátum-gyanú (F2.1-utó-8).
 *
 * Élesben talált probléma (2026-08-13): az Aqua Marina Hungary és a
 * sup-deszka.hu forrás nagyrészt UGYANAZT az Aqua Marina-katalógust árulja —
 * ugyanaz a valós termék két KÜLÖN pending jelöltként érkezik, eltérő
 * megfogalmazással (az egyik BT-kóddal, a másik méret+súllyal ír egy
 * modellt). A `tools/catalog-watch/match.ts` `matchCandidate`-je csak jelölt↔
 * ÉLŐ-deszka egyezést keres — jelölt↔jelölt között nincs ellenőrzés, ezért két
 * egymást fedő jelölt egyaránt jóváhagyható, valódi duplikátumot hozva létre
 * a `boards` táblában.
 *
 * TISZTA függvény, csak JELZÉST ad — nem dönt, nem utasít el, nem fésül
 * össze automatikusan. A moderátor dolga eldönteni, hogy a két sor tényleg
 * ugyanaz-e (a figyelő szemlélete szerint: „soha nem dönt/publikál magától").
 *
 * A hasonlóság-pontozás UGYANAZT a `@core/text/similarity` trigram-Jaccard
 * primitívet és UGYANAZOKAT a súlyokat használja, mint a
 * `tools/catalog-watch/match.ts` `scorePair`-je (a modul-szerződés miatt NEM
 * importálhatunk `tools/`-ból — a súlyok szándékosan tükrözik egymást a
 * konzisztencia kedvéért, ld. `match.ts` MODEL_WEIGHT/BRAND_WEIGHT).
 */
import { similarity } from "@core/text/similarity";

/** A modellnév súlya a márkával szemben — ld. `tools/catalog-watch/match.ts`. */
const MODEL_WEIGHT = 0.65;
const BRAND_WEIGHT = 0.35;

/**
 * Küszöb, ami alatt a hasonlóság inkább zaj, mint valódi duplikátum.
 * Élesben mintavételezve (2026-08-13, 172 pending jelölt páronkénti
 * összevetése): 0,5 felett a minta szinte mindig VALÓS forrásközi
 * duplikátum volt (pl. „Fusion BT-23FUP" ⇄ „FUSION BT-23FUP -62%"); 0,48
 * alatt már hamis pozitívok is megjelentek (pl. „Beast BT-23BEP" ⇄ „Dhyana
 * BT-23DHP", pusztán a közös „Aqua Marina...BT-2xXXP" alak miatt).
 */
export const DUPLICATE_HINT_THRESHOLD = 0.5;

export interface DuplicateHintCandidate {
  id: string;
  sourceId: string;
  brandName: string | null;
  modelName: string;
  modelYear: number | null;
  /** `null` = deszka; egyébként a kiegészítő-kategória. Deszka sosem párosul kiegészítővel. */
  accessoryType: string | null;
}

export interface DuplicateHint {
  /** A leginkább egyező MÁSIK pending jelölt azonosítója. */
  candidateId: string;
  score: number;
}

/**
 * Névazonosság a jelzéshez: kis-nagybetű és a szóközök nem különböztetnek meg
 * két terméket. Élesben (star-board.com) ugyanaz a deszka `10'0" X 34"` és
 * `10'0" x 34"` alakban is szerepel, mert a gyártó évjáratonként másképp írja.
 */
function sameModelName(a: string, b: string): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  const left = norm(a);
  return left !== "" && left === norm(b);
}

/**
 * Minden bemeneti jelölthöz megkeresi a legjobban egyező, MÁSIK FORRÁSBÓL
 * származó, AZONOS típusú (deszka↔deszka vagy azonos kategóriájú kiegészítő)
 * pending jelöltet — ha a pontszám eléri a küszöböt.
 *
 * A visszatérő `Map` kulcsa a jelölt `id`-ja; hiányzó kulcs = nincs elég erős
 * gyanú. O(n²) páronkénti összevetés — a katalógus mérete (száz nagyságrend)
 * mellett ez elhanyagolható futásidő, ugyanaz a megfontolás, mint a
 * `tools/catalog-watch/match.ts` dokumentációjában.
 */
export function findDuplicateHints(
  candidates: readonly DuplicateHintCandidate[],
): Map<string, DuplicateHint> {
  const hints = new Map<string, DuplicateHint>();

  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i]!;
    let best: DuplicateHint | null = null;

    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue;
      const b = candidates[j]!;
      if (a.accessoryType !== b.accessoryType) continue;
      // AZONOS FORRÁSON BELÜL is van valódi duplikátum, csak szigorúbb a
      // bizonyíték. Eredetileg a forrás-azonosság kizárt (a jelzés két BOLT
      // fedő katalógusára készült), élesben viszont a GYÁRTÓ maga is háromszor
      // adja ugyanazt a deszkát: a `2024-`, `2025-` és `2026-` termékoldal
      // ugyanarra a modellre, méretre és kivitelre. A moderátor emiatt nem
      // kapott jelzést, két Whopper párhuzamosan bekerült a katalógusba, és
      // moderátori jegyzet lett belőle.
      //
      // A küszöb itt NEM elég: egy márkán belül a szomszédos modellek nevei is
      // hasonlóak (`Whopper 10'0"` ⇄ `Whopper 11'0"`), ezért azonos forrásnál
      // csak a TELJES névazonosság számít. A modellnév a méretet és a kivitelt
      // is viseli, tehát az azonosság itt ugyanazt a terméket jelenti.
      if (a.sourceId === b.sourceId && !sameModelName(a.modelName, b.modelName)) continue;

      const brandScore = a.brandName && b.brandName ? similarity(a.brandName, b.brandName) : 0;
      const modelScore = similarity(a.modelName, b.modelName);
      const score = Math.round((brandScore * BRAND_WEIGHT + modelScore * MODEL_WEIGHT) * 1000) / 1000;

      if (score >= DUPLICATE_HINT_THRESHOLD && (!best || score > best.score)) {
        best = { candidateId: b.id, score };
      }
    }

    if (best) hints.set(a.id, best);
  }

  return hints;
}
