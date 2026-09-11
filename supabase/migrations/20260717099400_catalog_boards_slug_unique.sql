-- ============================================================================
-- MODUL: catalog — a `boards.slug` EGYEDISÉGE (2026-09-08).
--
-- ÉLESBEN MÉRT HIBA. Kétszer is létrejött ugyanaz a katalógus-sor, azonos
-- sluggal, néhány EZREDMÁSODPERC különbséggel:
--   * `jobe-pump-12v`      — 2026-09-06 15:31:39.210 és .354 (143 ms)
--   * `zray-vigour-airmat` — 2026-09-07 16:02:23.452 és .468 ( 16 ms)
-- A két sor az `id`-n és a három időbélyegen kívül MINDENBEN azonos volt.
--
-- AZ OK: a jóváhagyás előbb OLVASSA a jelölt „pending" állapotát és a szabad
-- slugot (`resolveUniqueSlug`), mint hogy írna. Két egyidejű kérés mindkettőt
-- szabadnak látja, és mindkettő beszúr — klasszikus check-then-act verseny.
-- Alkalmazás-szinten ezt nem lehet megbízhatóan lezárni; a 16 ms azt is
-- megmutatja, hogy nem emberi dupla kattintásról van szó.
--
-- MIÉRT NEM SZÉPSÉGHIBA: az adatlap `maybeSingle()`-lel keresi a slugot
-- (`boards.server.ts`), két találatnál hibát kap és `null`-t ad vissza —
-- vagyis a duplikálódott deszka adatlapja NEM NYITHATÓ MEG. Egy néma
-- adathiba némán 404-elő oldallá vált.
--
-- A VÉDELEM HELYE AZ ADATBÁZIS. Az egyediséget csak az tudja kikényszeríteni,
-- ami a két egyidejű írást egyszerre látja. A dupla beszúrás mostantól a
-- beszúrásnál hasal el, nem a katalógusban.
--
-- MINDKÉT NYELV KÜLÖN INDEXET KAP: a slug ma nyelvenként azonos értéket visel
-- (`slugify(márka + modellnév)`), de az útvonal-feloldás mindkettőre illeszt
-- (`slug->>hu.eq.… , slug->>en.eq.…`), tehát mindkettőnek egyedinek kell
-- lennie ahhoz, hogy egy URL-hez pontosan egy sor tartozzon.
--
-- ELŐFELTÉTEL: a migráció NEM megy fel, amíg létező ütközés van. Az ellenőrzés
--   select slug->>'hu', count(*) from public.boards
--   group by 1 having count(*) > 1;
-- A takarítás mindig ugyanaz az alak: a párból az marad, amelyikre HIVATKOZIK
-- valami (`catalog_candidates.matched_board_id`, `board_prices`,
-- `board_reviews`), és a hivatkozás nélküli iker megy — az adatvesztés így
-- kizárt, mert a két sor tartalmilag azonos.
-- ============================================================================

create unique index if not exists boards_slug_hu_unique_idx
  on public.boards ((slug ->> 'hu'));

create unique index if not exists boards_slug_en_unique_idx
  on public.boards ((slug ->> 'en'));
