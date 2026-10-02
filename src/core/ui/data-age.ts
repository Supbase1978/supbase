/**
 * Adatkor-szabály (FEJLESZTESI_DOKUMENTACIO 2. fejezet, 5. pont): 30 percnél
 * régebbi időjárás/vízadat automatikusan "Elavult adat" state-be vált (a
 * vízfelszín-vonal szaggatottra, a vízmérce csíkozottra vált, --stale szín +
 * "frissítve X perce" felirat). Tiszta, UI-mentes segédfüggvények — a
 * feliratot (pl. "frissítve 4 perce") a hívó fogalmazza meg i18n-ből, ez a
 * modul csak a küszöb-logikát adja.
 */

/** Ennyi percnél régebbi adat számít elavultnak. */
/**
 * BIZTONSÁGI INVARIÁNS (2. fejezet 5. szabály), NEM tunable konfig.
 *
 * Az F1.3-reviewer m3-as findingja szerint a seedben volt egy holt
 * `supindex.stale_minutes` kulcs. Az F1.10-ben azt KIVETTÜK, nem bekötöttük:
 * ha az adatkor-küszöb adatbázisból állítható lenne, egy elgépelt érték
 * csendben kikapcsolhatná az „Elavult adat" jelzést — épp azt a védelmet,
 * ami miatt a szabály létezik (cache-elt viharjelzés SOHA nem aktuális).
 */
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

/** Az adatkor egysége — a hívó ebből választ i18n-plurál-kulcsot. */
export type AgeUnit = "minute" | "hour" | "day";

export interface AgeDescription {
  unit: AgeUnit;
  count: number;
}

/**
 * Elavult adatnál a puszta "Elavult adat" felirat napokkal régebbinek
 * tűnhet, mint amennyi valójában eltelt (lásd a hívó UI-k kommentjét). Ez a
 * helper az eltelt időt egység+szám párra bontja, hogy a hívó pontos
 * feliratot adhasson ("38 perce" / "3 órája" / "2 napja") — maga NEM formáz
 * szöveget, i18n-t nem importál.
 *
 * Küszöbök: < 60 perc → perc, < 24 óra → óra, egyébként nap. A kerekítés
 * egység-határon átbillenhetne (pl. 59.6 perc kerekítve 60 percre) — ezért a
 * bucketet a PONTOS (nem kerekített) értékkel választjuk, a megjelenített
 * számot pedig a kiválasztott egységben kerekítjük; így sosem jelenik meg
 * "60 perce" vagy "24 órája".
 *
 * Érvénytelen/jövőbeli dátumnál biztonsági okból 0 perces korral tér vissza
 * (lásd `isStale` hasonló indoklását) — a hívó ettől függetlenül az
 * `isStale` eredménye alapján dönt, hogy EGYÁLTALÁN megjelenik-e az elavult
 * state.
 */
export function describeAge(
  updatedAt: Date | string,
  now: Date = new Date(),
): AgeDescription {
  const totalMinutes = minutesSince(updatedAt, now);
  if (Number.isNaN(totalMinutes) || totalMinutes <= 0) {
    return { unit: "minute", count: 0 };
  }

  // A bucket-választás a KEREKÍTETT értéken alapul (nem a nyersen), mert egy
  // kerekítés (pl. 59.6 perc → 60) egység-határon billenthetne át — ez adná
  // a "60 perce"/"24 órája" megjelenítési hibát.
  const roundedMinutes = Math.round(totalMinutes);
  if (roundedMinutes < 60) {
    return { unit: "minute", count: roundedMinutes };
  }

  const totalHours = totalMinutes / 60;
  const roundedHours = Math.round(totalHours);
  if (roundedHours < 24) {
    return { unit: "hour", count: roundedHours };
  }

  return { unit: "day", count: Math.round(totalHours / 24) };
}

/**
 * `describeAge().unit` → `core` namespace i18n-plurálkulcs ("Elavult adat ·
 * {{count}} perce/órája/napja frissült"). Egy helyen tartva, hogy a két
 * hívási hely (spot-adatlap fejléce, `SpotCard`) ne duplikálja a kulcsneveket.
 */
export const STALE_AGE_KEYS: Record<AgeUnit, string> = {
  minute: "dataAge.staleMinutesAgo",
  hour: "dataAge.staleHoursAgo",
  day: "dataAge.staleDaysAgo",
};
