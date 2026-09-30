/**
 * Oldal-szintű elrendezés-konstansok.
 *
 * MIÉRT KELL: a fejléc és a tartalom KORÁBBAN külön-külön adta meg a
 * max-szélességét (nav `max-w-5xl`, a lapok fele `max-w-3xl`, egy `max-w-2xl`).
 * Mivel mindkettő `mx-auto`-val középre igazít, a KÜLÖNBÖZŐ szélességek eltérő
 * bal szélt eredményeztek — a tartalom láthatóan elcsúszott a menühöz képest
 * (768 px vs. 1024 px → 128 px eltérés).
 *
 * Innentől EGY forrás van. A komponensekben az osztálynév SZÁNDÉKOSAN literál
 * marad (a Tailwind csak a forrásban szó szerint szereplő osztályt generálja,
 * template-literálból összerakottat nem), az egyezést viszont teszt őrzi:
 * `app/routes/layout-width.test.ts`. Szélesség-váltásnál ITT és a teszt által
 * jelzett fájlokban kell átírni — a teszt megmutatja, hol maradt el.
 */

/** A lap-tartalom kanonikus max-szélessége (a fejléc is ezt használja). */
export const PAGE_MAX_WIDTH = "max-w-5xl";

/** Teljes lap-konténer: középre igazítva, kanonikus szélességgel. */
export const PAGE_CONTAINER = `mx-auto w-full ${PAGE_MAX_WIDTH}`;

// A vízszintes belső margó is közös: fejléc `px-4 sm:px-6`, lapok `p-4 sm:p-6`.
// Eltérés esetén a fejléc tartalma oldalra csúszik (640 px fölött `px-4` vs.
// `sm:p-6` → 8 px volt). Az egyezést szintén a layout-width teszt őrzi.

/**
 * Hosszú, folyamatos szöveghez (jogi oldalak, leírások) szűkebb sormérték.
 * A KÜLSŐ konténer marad a kanonikus szélességen — így a bal szél továbbra is
 * igazodik a menühöz —, csak a szövegblokk keskenyedik.
 */
export const PROSE_MAX_WIDTH = "max-w-3xl";
