/**
 * catalog-watch — a figyelő futás-specifikus életciklus-döntései.
 *
 * A KIFUTÁS felismerése a katalógus doménjéhez tartozik, ezért a
 * `@modules/catalog/lifecycle`-ben él (onnan használja a CLI és az admin
 * felület is). Itt csak az marad, ami a crawl-futáshoz kötődik.
 */
export {
  DEFAULT_UNSEEN_DAYS,
  findDiscontinuedCandidates,
  type BoardForLifecycle,
  type DiscontinuedCandidate,
} from "../../src/modules/catalog/lifecycle.ts";

import type { BoardForLifecycle } from "../../src/modules/catalog/lifecycle.ts";

/**
 * `availability_hu` új értéke: van-e a mostani futásban aktív HU bolt-listing.
 * Csak akkor ad vissza értéket, ha VÁLTOZIK — így a store nem ír fölöslegesen.
 *
 * A deszkát, amit a mostani futás egyáltalán nem érintett, nem nyúljuk meg:
 * a `seenInStock` `undefined` (nem `false`) jelzi, hogy nincs információnk.
 */
export function nextAvailability(
  board: Pick<BoardForLifecycle, "availability_hu">,
  seenInStock: boolean | undefined,
): boolean | null {
  if (seenInStock === undefined) return null;
  return seenInStock === board.availability_hu ? null : seenInStock;
}

/**
 * Kell-e ÚJ ársort írni? Csak ÁRVÁLTOZÁSKOR (vagy ha még nincs ár ettől a
 * bolttól). A heti crawl különben deszkánként/boltonként évi 52 azonos sort
 * termelne, amiből az ártörténet (F3 árfigyelő) nem lesz jobb, a tábla viszont
 * feleslegesen hízik. A „mikor láttuk utoljára" információt a
 * `boards.last_seen_at` hordozza, nem az ársor.
 */
export function shouldRecordPrice(
  previousPriceHuf: number | null | undefined,
  nextPriceHuf: number,
): boolean {
  if (previousPriceHuf === null || previousPriceHuf === undefined) return true;
  return previousPriceHuf !== nextPriceHuf;
}
