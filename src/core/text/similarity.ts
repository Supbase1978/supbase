/**
 * Trigram-alapú szöveghasonlóság (core).
 *
 * Eredetileg a catalog-watch `match.ts`-ében élt (jelölt↔élő-deszka egyezés-
 * keresés). Amikor a catalog modul admin-felületének is szüksége lett rá
 * (jelölt↔jelölt duplikátum-gyanú, F2.1-utó-8), a modul-szerződés (1.3)
 * szerint a KÖZÖS IGÉNY A CORE-BA kerül — a `src/modules/*` nem importálhat
 * `tools/`-ból, modul→modul import pedig tilos. Ugyanez történt a
 * `slugify`-jal (ld. `./slug.ts`) és a `RatingBar`-ral (F1.6-utó).
 *
 * A hasonlóság a PostgreSQL `pg_trgm`-jével AZONOS algoritmus, JS-ben: a
 * szavakat két szóközzel elöl és eggyel hátul kipárnázva trigramokra bontjuk,
 * és a halmazok Jaccard-hányadosát vesszük.
 */

/** Ékezet- és kisbetű-semleges összehasonlító alak. */
function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

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

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
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
