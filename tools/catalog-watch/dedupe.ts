/**
 * catalog-watch — jelölt–jelölt DUPLIKÁTUM-ÖSSZEVONÁS (F2.1-utó-19, 2026-08-19).
 *
 * MIÉRT KELL: ugyanaz a deszka több forrásból is bejön — a gyártó saját
 * oldaláról ÉS a kereskedőktől. Élesben mérve 136 ilyen csoport keletkezett
 * (pl. `aqua marina|monster` háromszor). Ha mindet jóváhagynánk, a
 * katalógusban háromszor jelenne meg ugyanaz a Monster.
 *
 * A SZABÁLY (felhasználói döntés, 2026-08-19):
 *  1. **A GYÁRTÓI NÉV A HIVATALOS** — a gyártói forrásból származó jelölt
 *     nyer, mert a kereskedők átnevezik a terméket („ISUP", „2024",
 *     csomagajánlat), amitől ugyanaz a deszka több néven kerülne be.
 *  2. **A hiányzó gyártói adatot a kereskedői lapról vesszük át** — ha a
 *     gyártónál nincs meg a súly, de a bolt kiírta, az az érték kerül be.
 *
 * A csoportosítás ugyanazzal a trigram-hasonlósággal megy, amit az
 * egyezés-keresés használ (`match.ts`) — nem külön heurisztika.
 *
 * TISZTA modul: se hálózat, se adatbázis. A hívó adja a jelölteket, és a
 * döntést kapja vissza.
 */
import { KNOWN_THRESHOLD, BRAND_THRESHOLD, scorePair } from "./match.ts";
import type { BoardSpecs, ExtractedProduct } from "./types.ts";

/** Egy jelölt a döntéshez szükséges mezőkkel. */
export interface DedupeCandidate {
  id: string;
  url: string;
  extracted: ExtractedProduct;
  /**
   * A forrás fajtája. A `brand_site` a GYÁRTÓI oldal — ez nyer a bolttal
   * szemben, mert a modellnév ott hivatalos.
   */
  sourceKind: "brand_site" | "shop" | "feed";
  sourceName: string;
}

/** Egy összevont csoport: egy nyertes, nulla vagy több beolvasztott jelölt. */
export interface DedupeGroup {
  /** Ez kerül `boards`-ba. A specifikációja MÁR kiegészítve a többiekéből. */
  winner: DedupeCandidate;
  /** Ezek `merged` státuszt kapnak, a nyertesből lett board-ra mutatva. */
  merged: DedupeCandidate[];
  /** Mely mezőket vettük át a beolvasztottaktól — a napló ezt írja ki. */
  filledFields: NumericSpecField[];
}

/**
 * A hat SZÁMSZERŰ mérőszám. Külön típus, mert a `BoardSpecs` hetedik mezője
 * (`inflatable`) boolean — ha az is beleférne a listába, a mezőnkénti másolás
 * nem lenne típusbiztos.
 */
type NumericSpecField = "lengthCm" | "widthCm" | "thicknessCm" | "volumeL" | "weightKg" | "maxLoadKg";

const SPEC_FIELDS: NumericSpecField[] = [
  "lengthCm",
  "widthCm",
  "thicknessCm",
  "volumeL",
  "weightKg",
  "maxLoadKg",
];

/** Hány mérőszám van kitöltve — döntetlennél ez választ. */
function filledCount(specs: BoardSpecs): number {
  return SPEC_FIELDS.filter((field) => specs[field] !== null).length;
}

/**
 * Ki a jobb jelölt? Sorrendben: gyártói forrás → több kitöltött mérőszám →
 * van kategória-tipp. Determinisztikus: azonos pontszámnál az `id` dönt, hogy
 * két futás ugyanazt az eredményt adja.
 */
function isBetter(a: DedupeCandidate, b: DedupeCandidate): boolean {
  const brandSite = (c: DedupeCandidate) => (c.sourceKind === "brand_site" ? 1 : 0);
  if (brandSite(a) !== brandSite(b)) return brandSite(a) > brandSite(b);

  const filled = (c: DedupeCandidate) => filledCount(c.extracted.specs);
  if (filled(a) !== filled(b)) return filled(a) > filled(b);

  const typed = (c: DedupeCandidate) => (c.extracted.boardType !== null ? 1 : 0);
  if (typed(a) !== typed(b)) return typed(a) > typed(b);

  return a.id < b.id;
}

/**
 * Két jelölt ugyanaz a deszka?
 *
 * A küszöb a `match.ts` KONZERVATÍV `KNOWN_THRESHOLD`-ja, és a márkának is
 * egyeznie kell — két gyártó használhatja ugyanazt a modellnevet („Explorer"),
 * és egy téves összeolvasztás két különböző deszkát tüntetne el egyetlenné.
 *
 * A MÉRET is feltétel: a `12'0"` és a `10'8"` GO KÜLÖN deszka, pedig a nevük
 * hasonló. Ezt a hossz összevetése dönti el (5 cm tűréssel — a gyártók
 * kerekítenek), és ha valamelyik hossza ismeretlen, NEM vonjuk össze.
 */
export function isSameBoard(a: DedupeCandidate, b: DedupeCandidate): boolean {
  const { score, brandScore } = scorePair(a.extracted, {
    id: b.id,
    brandName: b.extracted.brandName,
    modelName: b.extracted.modelName,
    modelYear: b.extracted.modelYear,
  });
  if (score < KNOWN_THRESHOLD || brandScore < BRAND_THRESHOLD) return false;

  const lengthA = a.extracted.specs.lengthCm;
  const lengthB = b.extracted.specs.lengthCm;
  if (lengthA === null || lengthB === null) return false;
  return Math.abs(lengthA - lengthB) <= 5;
}

/**
 * Jelöltek csoportosítása és összevonása.
 *
 * Egyszerű, determinisztikus csoportosítás: a lista sorrendjében minden jelölt
 * vagy beolvad egy MÁR meglévő csoportba (ha a csoport nyertesével azonos
 * deszka), vagy új csoportot nyit. Nem globális optimum — de átlátható, és a
 * konzervatív küszöbök mellett a gyakorlatban egyértelmű.
 */
export function dedupeCandidates(candidates: readonly DedupeCandidate[]): DedupeGroup[] {
  const groups: DedupeGroup[] = [];

  for (const candidate of candidates) {
    const group = groups.find((g) => isSameBoard(candidate, g.winner));
    if (!group) {
      groups.push({ winner: candidate, merged: [], filledFields: [] });
      continue;
    }
    if (isBetter(candidate, group.winner)) {
      group.merged.push(group.winner);
      group.winner = candidate;
    } else {
      group.merged.push(candidate);
    }
  }

  // A hiányzó mezők pótlása a beolvasztottakból — a nyertes SAJÁT értékét soha
  // nem írjuk felül, csak a `null`-okat töltjük.
  for (const group of groups) {
    if (group.merged.length === 0) continue;
    const specs: BoardSpecs = { ...group.winner.extracted.specs };
    for (const field of SPEC_FIELDS) {
      if (specs[field] !== null) continue;
      for (const other of group.merged) {
        const value = other.extracted.specs[field];
        if (value === null) continue;
        specs[field] = value;
        group.filledFields.push(field);
        break;
      }
    }
    // A kategória-tipp is átvehető, ha a nyertesnek nincs.
    const boardType =
      group.winner.extracted.boardType ??
      group.merged.find((o) => o.extracted.boardType !== null)?.extracted.boardType ??
      null;
    group.winner = {
      ...group.winner,
      extracted: { ...group.winner.extracted, specs, boardType },
    };
  }

  return groups;
}
