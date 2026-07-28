/**
 * Slug-helperek (core).
 *
 * A `slugify` eredetileg a providers modulban élt. Amikor a catalog-watch
 * moderációnak is szüksége lett rá (jóváhagyott jelöltből `boards.slug`), a
 * modul-szerződés (1.3) szerint a KÖZÖS IGÉNY A CORE-BA kerül — modul→modul
 * import tilos volna. Ugyanez történt a `RatingBar`-ral (F1.6-utó).
 */

/**
 * Slug-alak: kisbetű/szám/kötőjel. A PostgREST `.or()` szűrőkbe illesztett
 * slugokat ezzel a mintával ellenőrizzük (szűrő-injektálás elleni guard).
 */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Név → URL-biztos slug (kisbetű, ékezet-hajtás, nem-alfanumerikus → kötőjel).
 * A hossz 60 karakterre vágva, hogy az URL kezelhető maradjon.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // ékezetek levágása
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
