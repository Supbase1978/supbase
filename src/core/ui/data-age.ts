/**
 * Adatkor-szabály (FEJLESZTESI_DOKUMENTACIO 2. fejezet, 5. pont): 30 percnél
 * régebbi időjárás/vízadat automatikusan "Elavult adat" state-be vált (a
 * vízfelszín-vonal szaggatottra, a vízmérce csíkozottra vált, --stale szín +
 * "frissítve X perce" felirat). Tiszta, UI-mentes segédfüggvények — a
 * feliratot (pl. "frissítve 4 perce") a hívó fogalmazza meg i18n-ből, ez a
 * modul csak a küszöb-logikát adja.
 */

/** Ennyi percnél régebbi adat számít elavultnak. */
export const STALE_THRESHOLD_MINUTES = 30;

/**
 * Hány perc telt el `updatedAt` óta `now`-hoz képest.
 * Érvénytelen dátum esetén `NaN`-t ad vissza (a hívó ne bízzon meg benne).
 */
export function minutesSince(
  updatedAt: Date | string,
  now: Date = new Date(),
): number {
  const updated =
    typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;

  if (Number.isNaN(updated.getTime()) || Number.isNaN(now.getTime())) {
    return Number.NaN;
  }

  return (now.getTime() - updated.getTime()) / 60_000;
}

/**
 * Elavultnak számít-e az adat: 30 perc vagy annál régebbi, VAGY ha a dátum
 * érvénytelen/hiányos — ilyenkor biztonsági okból elavultként kezeljük
 * (cache-elt viharjelzés SOHA nem jelenhet meg aktuálisként).
 */
export function isStale(
  updatedAt: Date | string,
  now: Date = new Date(),
): boolean {
  const minutes = minutesSince(updatedAt, now);
  return Number.isNaN(minutes) || minutes >= STALE_THRESHOLD_MINUTES;
}
