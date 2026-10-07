-- ============================================================================
-- MODUL: catalog — SZÍNVÁLTOZATOK EGY SORBAN (2026-10-07).
--
-- A színváltozatok (pl. Bluefin „Cruise Red" / „Cruise Blue") ugyanaz a deszka,
-- csak színben térnek el — külön katalógus-sorként szétforgácsolnák a Közös
-- nevező-adatot és a Deszkaválasztó-ajánlást. Ezért egy sor, a színek listája
-- pedig ezen az oszlopon utazik.
--
-- NEM enum és NEM fordított jsonb: a színnév márkánként/termékvonalanként
-- egyedi tulajdonnév („Gecko", „Cruise Blue"), nincs értelmes hu/en párja.
--
-- A KIVITEL (Construction, pl. Starboard „Blue Carbon") NEM szín — az külön
-- sor marad, ide soha nem kerülhet. A listát az admin „Összefésülés" lépésben
-- a MODERÁTOR tölti, automatikus névelemzés nincs.
-- ============================================================================

alter table public.boards
  add column if not exists colors text[] not null default '{}';

comment on column public.boards.colors is
  'Elérhető színváltozatok (szabad szöveg, márkánként egyedi nevek). NEM kivitel: a Construction külön sor. A moderátor tölti az Összefésülésnél.';
