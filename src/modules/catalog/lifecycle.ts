/**
 * catalog — életciklus: kifutó modellek felismerése
 * (docs/CATALOG_WATCH_TERV.md 4. pont).
 *
 * TISZTA modul, a katalógus DOMÉN-szabálya, ezért itt él és nem a figyelőben:
 * ugyanezt a döntést használja a `tools/catalog-watch` CLI `lifecycle`
 * parancsa ÉS az admin moderációs felület — egy implementáció, egy tesztkészlet.
 *
 * Két erős megkötés:
 *
 * 1. **A figyelő nem állít státuszt, csak JELÖL.** A `discontinued` végleges
 *    státuszt az admin erősíti meg — a crawl-kimaradás (bolt átszabta a
 *    sitemapet, forrás leállt) nem jelenti, hogy a modell eltűnt a piacról.
 * 2. **Amit a figyelő SOHA nem látott (`last_seen_at === null`), az érintetlen
 *    marad.** A kézzel/seedből felvitt katalógus-sorok nem eshetnek ki csak
 *    azért, mert egyik forrásunk sem árulja őket.
 *
 * A kifutott modell nem törlődik: a Közös nevező-vélemények és a
 * Deszkaválasztó-történet megmarad, az adatlapon „már nem kapható" jelzéssel.
 */

/** Az életciklus-vizsgálathoz szükséges deszka-vetület. */
export interface BoardForLifecycle {
  id: string;
  modelName: string;
  status: string;
  last_seen_at: string | null;
  availability_hu: boolean;
}

export interface DiscontinuedCandidate {
  boardId: string;
  modelName: string;
  lastSeenAt: string;
  /** Hány napja nem látta egyetlen aktív forrás sem. */
  daysUnseen: number;
}

/**
 * Heti crawl mellett 4 egymást követő kimaradás ≈ 1 hónap (terv: N=4).
 * Napokban tartjuk, mert így a kihagyott futás (CI-kiesés) nem tolja el.
 */
export const DEFAULT_UNSEEN_DAYS = 28;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Kifutás-jelöltek: `active` státuszú, a figyelő által MÁR LÁTOTT deszkák,
 * amelyeket a küszöbnél régebben nem hozott vissza egyetlen forrás sem.
 */
export function findDiscontinuedCandidates(
  boards: readonly BoardForLifecycle[],
  options: { now?: Date; unseenDays?: number } = {},
): DiscontinuedCandidate[] {
  const now = options.now ?? new Date();
  const unseenDays = options.unseenDays ?? DEFAULT_UNSEEN_DAYS;

  const result: DiscontinuedCandidate[] = [];
  for (const board of boards) {
    if (board.status !== "active") continue;
    if (board.last_seen_at === null) continue;

    const lastSeen = new Date(board.last_seen_at).getTime();
    if (!Number.isFinite(lastSeen)) continue;

    const daysUnseen = Math.floor((now.getTime() - lastSeen) / MS_PER_DAY);
    if (daysUnseen >= unseenDays) {
      result.push({
        boardId: board.id,
        modelName: board.modelName,
        lastSeenAt: board.last_seen_at,
        daysUnseen,
      });
    }
  }
  return result.sort((a, b) => b.daysUnseen - a.daysUnseen);
}
