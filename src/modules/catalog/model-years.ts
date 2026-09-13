/**
 * MODELLÉV-FELIRAT: `2024` vagy `2024-2025`.
 *
 * KÜLÖN FÁJL, mert három oldalról kell (F2.1-utó-62): a moderációs
 * merge-legördülő (`data/candidates.server.ts`), a publikus deszka-kártya és
 * az adatlap. A kártya a `.server.ts`-t nem importálhatja — az szerver-kód.
 *
 * TÖBB ÉVJÁRAT EGY SORON (felhasználói döntés, 2026-09-13): ahol a gyártó több
 * évben AZONOS adattal hozta a deszkát, ott EGY sor áll, és a felirat kimondja,
 * mely évekre érvényes — így a korábbi évjáratot kereső használó is megtalálja.
 * Ahol érdemben változott (tömeg, TEHERBÍRÁS, vastagság), ott évjáratonként
 * külön sor van, mindegyik egyetlen évvel.
 *
 * NEM tartomány-rövidítés: a hiányzó közbenső évet nem hidaljuk át, mert az
 * olyat állítana arról az évjáratról, amit nem mértünk.
 */
export function modelYearLabel(
  years: number[] | null | undefined,
  fallback: number | null | undefined,
): string | null {
  const list = [...new Set((years ?? []).filter((y) => Number.isFinite(y)))].sort((a, b) => a - b);
  if (list.length > 0) return list.join("-");
  return fallback ? String(fallback) : null;
}
