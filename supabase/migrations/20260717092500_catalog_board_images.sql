-- ============================================================================
-- MODUL: catalog — TÖBB termékkép egy katalógus-soron (F2.1-utó-30).
-- ÚJ migráció, ADDITÍV: a 20260717091000-es catalog_boards migrációt NEM
-- bolygatja, adatot nem mozgat.
--
-- MIÉRT: a telefonos listanézet KÉT oszlopos, tehát a kártya-kép kicsi
-- (~170 px) — ez az ára annak, hogy két deszka egymás MELLETT látszik, és így
-- összehasonlítható. A részleteket az adatlap teljes képernyős nézete adja
-- vissza, ahol a modell több képe között legyintéssel lehet váltani.
--
-- A BORÍTÓ MARAD az `image_url`: a rácsban az összehasonlítás azon áll, hogy
-- minden kártya UGYANOLYAN nézetet mutat (a gyártói front/back render). Ezért
-- nem "az images tömb első eleme" a borító, hanem továbbra is egy külön,
-- moderátor által választott mező — a lista lekérdezései változatlanok
-- maradnak, és a lista nem tölt be galéria-adatot.
--
-- A `source` mező MOST kerül be, pedig egyelőre mindig 'brand': a véleményezői
-- fotó (deszka a vízen) a platform saját tartalma lesz, és jobb, ha nem kell
-- miatta migrálni. A tömb SORRENDJE a megjelenítés sorrendje.
--
-- RLS: VÁLTOZATLAN. Ugyanaz a kurált tartalom, mint a többi boards-oszlop —
-- publikus olvasás (`boards_public_read`), írás csak moderator/admin
-- (`boards_mod_write`). Oszlop-hozzáadás nem igényel új policyt.
-- ============================================================================

alter table public.boards
  add column if not exists images jsonb not null default '[]'::jsonb;

-- Alak-kényszer: TÖMB legyen, ne objektum vagy skalár. A tömb ELEMEINEK
-- alakját szándékosan nem kényszerítjük SQL-ben — az az alkalmazás-oldali
-- típus dolga (`BoardImage`), és egy szigorú jsonb-check a bővítést
-- (pl. felirat, szerző) migrációhoz kötné.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'boards_images_is_array' and conrelid = 'public.boards'::regclass
  ) then
    alter table public.boards add constraint boards_images_is_array
      check (jsonb_typeof(images) = 'array');
  end if;
end $$;

comment on column public.boards.images is
  'A modell TOVÁBBI képei a teljes képernyős nézethez, megjelenítési sorrendben: [{"url": "...", "source": "brand"|"user"}]. A BORÍTÓ nem itt van, hanem az image_url-ben (a rács összehasonlíthatósága miatt külön, moderátor által választott mező). Üres tömb = egy képes deszka: a felület ilyenkor nem mutat pöttysort és nem enged legyintést.';
