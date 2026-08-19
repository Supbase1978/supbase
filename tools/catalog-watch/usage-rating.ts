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
