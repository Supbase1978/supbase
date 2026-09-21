-- ============================================================================
-- MODUL: catalog — ÚJ DESZKATÍPUS: `surf` (2026-09-21).
--
-- MIÉRT: a moderációs sorban NÉGY jegyzet kérte ugyanezt, két gyártótól:
--   * Red `8'10" Compact MSL Pact` — „ez egy szörf sup, amilyen kategóriánk
--     még nincsen (illetve deszkatípus), így nehéz besorolni";
--   * Starboard `Hyper Nut 7'4"` és `8'0"` — „tengeri SUP (kellene egy ilyen
--     kategória)";
--   * Starboard `GO Surf 10'6"` — „tengeri SUP".
-- A meglévő hét típus egyikébe sem fér: a szörf-SUP rövid (7–9 láb), kis
-- térfogatú, hullámra tervezett deszka — se nem allround, se nem river.
-- Besorolás híján ezek a jelöltek a moderációs sorban ragadtak.
--
-- KÉT KÜLÖN KÉNYSZERT kell bővíteni: a `board_type` az átmeneti fő kategória,
-- a `board_types` a teljes lista (F2.1-utó-41). Elgépelt érték csendben
-- láthatatlan lenne — a Deszkaválasztó nem illesztené, a felület nem mutatná.
--
-- A NÉV SZERINTI DROP NEM MŰKÖDIK: a `board_type` kényszere INLINE `check`-ként
-- született (`20260717091000`), tehát a nevét a Postgres generálta, és nem
-- garantált. Rossz néven a `drop constraint if exists` NÉMÁN nem csinál semmit,
-- utána az `add` a régi kényszer mellé kerülne — a `surf` továbbra is tiltott
-- maradna, de a migráció sikeresnek látszana.
--
-- Ezért a DEFINÍCIÓ alapján keressük meg őket: azok a CHECK-ek, amelyek az
-- ÉRTÉKLISTÁT tartalmazzák (`'allround'`). Ez pontosan a két bővítendő
-- kényszerre illeszkedik — a `boards_kind_shape` (kind ⇄ board_type/
-- accessory_type összhang) NEM említ értéket, tehát érintetlen marad. Ez a
-- megkülönböztetés szándékos: a `board_type`-ra hivatkozó összes kényszer vak
-- eldobása azt a szerkezeti védelmet is elvinné.
-- ============================================================================

do $$
declare
  con record;
begin
  for con in
    select conname
      from pg_constraint
     where conrelid = 'public.boards'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%''allround''%'
  loop
    execute format('alter table public.boards drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.boards
  add constraint boards_board_type_known
  check (
    board_type is null
    or board_type in
      ('allround', 'touring', 'race', 'yoga', 'kids', 'fishing', 'river', 'surf')
  );

alter table public.boards
  add constraint boards_board_types_known
  check (
    board_types <@ array[
      'allround', 'touring', 'race', 'yoga', 'fishing', 'river', 'kids', 'surf'
    ]::text[]
  );

comment on constraint boards_board_type_known on public.boards is
  'A `board_type` ismert érték vagy NULL. A NULL-t a `boards_kind_shape` köti meg: kiegészítőnél kötelezően NULL, deszkánál kötelezően kitöltött.';
