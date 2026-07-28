-- ============================================================================
-- MODUL: catalog — `kind` diszkriminátor a boards táblán (F2.3 2. szakasz).
-- ÚJ migráció, ADDITÍV: az F1.2-es catalog-migrációt (20260717091000) NEM
-- bolygatja, sort nem töröl, oszlopot nem szűkít.
--
-- MIÉRT A MEGLÉVŐ TÁBLÁBA: külön `accessories` tábla magával rántaná a
-- `board_prices` (board_id FK), a `board_reviews` (board_id FK + unique
-- (board_id, user_id)) és a `catalog_candidates` (matched_board_id)
-- párhuzamosítását is — háromszoros felület egy másodlagos doménért. A
-- diszkriminátorral az ár-, vélemény- és moderációs pipeline VÁLTOZATLAN.
--
-- A TÁBLA NEVE MARAD `boards`: az átnevezés minden lekérdezést, RLS-policyt és
-- FK-t érintene élesben; a jelentést a `kind` oszlop és a kommentek hordozzák.
--
-- AZ ÁR, AMIT EZÉRT FIZETÜNK (korrektségi invariáns): MINDEN deszka-listázó
-- lekérdezésnek `kind = 'board'` szűrőt kell kapnia, különben a Deszkaválasztó
-- evezőt ajánlhatna deszkaként. Az adatréteg oldalán ezt az
-- `app/routes/deszkavalaszto.kind.test.ts` őrszem-teszt őrzi.
--
-- RLS: VÁLTOZATLAN. A kiegészítő ugyanaz a kurált tartalom, mint a deszka —
-- publikus olvasás (`boards_public_read`), írás csak moderator/admin
-- (`boards_mod_write`). Új policy nem kell, a meglévők kind-agnosztikusak.
-- ============================================================================

-- --- Diszkriminátor + kategória ---------------------------------------------
-- A `kind` default 'board': a meglévő 20 seed-deszka (és minden élő sor)
-- érintetlenül, deszkaként marad.
alter table public.boards
  add column if not exists kind text not null default 'board'
    check (kind in ('board', 'accessory'));

-- A kategória-lista ZÁRT, és a `src/modules/catalog/gear.ts` GEAR_CATEGORIES
-- konstansával azonos (a domain-review 2.8 + a boltokban látott kínálat).
-- A két oldal együtt mozog: itt bővíteni csak új migrációval szabad.
alter table public.boards
  add column if not exists accessory_type text
    check (accessory_type in ('evezo', 'poraz', 'mentomelleny', 'pumpa',
                              'szarazzsak', 'ules', 'uszony', 'taska'));

-- --- Alak-kényszer -----------------------------------------------------------
-- A `board_type` eddig NOT NULL volt: kiegészítőnél értelmetlen (egy evezőnek
-- nincs 'allround' típusa). A NOT NULL feloldása LAZÍTÁS, nem adatvesztés — a
-- meglévő sorok értékei érintetlenek; a kötelezőséget kind-függően a
-- `boards_kind_shape` CHECK viszi tovább.
alter table public.boards alter column board_type drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'boards_kind_shape' and conrelid = 'public.boards'::regclass
  ) then
    alter table public.boards add constraint boards_kind_shape check (
      (kind = 'board'     and board_type is not null and accessory_type is null) or
      (kind = 'accessory' and accessory_type is not null and board_type is null)
    );
  end if;
end $$;

-- Minden publikus olvasás ezen a szűrőn megy át (`kind = 'board'`).
create index if not exists boards_kind_idx on public.boards (kind);

comment on column public.boards.kind is
  'Diszkriminátor: board (deszka) | accessory (felszerelés). MINDEN deszka-listázó lekérdezés kind=''board''-ra szűr — a Deszkaválasztó SOHA nem ajánlhat kiegészítőt.';
comment on column public.boards.accessory_type is
  'Felszerelés-kategória (kind=''accessory'' esetén kötelező, deszkánál NULL). Zárt lista, a src/modules/catalog/gear.ts GEAR_CATEGORIES párja.';
comment on column public.boards.board_type is
  'Deszka-kategória (kind=''board'' esetén kötelező, kiegészítőnél NULL) — a boards_kind_shape kényszer tartja be.';
comment on column public.boards.stability_index is
  'Generált oszlop (szélesség/vastagság/térfogat). Kiegészítőnél NULL, mert a bemenetei nullák — ez rendben van, az oszlop nullable.';
