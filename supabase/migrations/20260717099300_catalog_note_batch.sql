-- ============================================================================
-- MODUL: catalog — a moderátori jegyzetek KÖTEGES átadása (2026-08-31).
--
-- MIÉRT: a jegyzeteket egyesével feldolgozni drága és lassú (felhasználói
-- észrevétel). A moderátor végigmegy a soron, menet közben jegyzetel, és
-- amikor végzett egy körrel, EGY gombbal átadja az egészet — a javítás így
-- forrásonként összefogható: egy mérés, egy szabály, egy fixtúra.
--
-- KÉT IDŐBÉLYEG, mert három állapot van, és mindegyik másra jó:
--   * `moderator_note` kitöltve, `note_submitted_at` üres → MÉG ÍRJA a
--     moderátor; ilyenkor nem szabad hozzányúlni (félbehagyott gondolat).
--   * `note_submitted_at` kitöltve, `note_resolved_at` üres → ÁTADVA, ez a
--     fejlesztés teendő-listája.
--   * `note_resolved_at` kitöltve → KÉSZ; a jegyzet megmarad (a MIÉRT-et
--     őrzi), de nem kerül elő újra.
--
-- MIÉRT NEM egy `status` enum: az időbélyeg megmondja azt is, MIKOR történt —
-- ebből látszik, mennyi idő telt el az átadás és a javítás között, és a
-- jegyzet a jelölt sorsától függetlenül olvasható marad.
-- ============================================================================

alter table public.catalog_candidates
  add column if not exists note_submitted_at timestamptz,
  add column if not exists note_resolved_at  timestamptz;

comment on column public.catalog_candidates.note_submitted_at is
  'Mikor adta át a moderátor a jegyzetet feldolgozásra (a „kész" gomb). Üres = még írja.';
comment on column public.catalog_candidates.note_resolved_at is
  'Mikor lett a jegyzetben jelzett hiba javítva. Üres és `note_submitted_at` kitöltve = teendő.';

-- A teendő-lista lekérdezése (`list-notes`) ezen a két oszlopon szűr; a tábla
-- kicsi, de a részleges index olcsó és a szándékot is dokumentálja.
create index if not exists catalog_candidates_open_notes_idx
  on public.catalog_candidates (note_submitted_at)
  where moderator_note is not null and note_resolved_at is null;
