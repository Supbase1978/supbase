-- ============================================================================
-- MODUL: catalog — „A GYÁRTÓ NEM KÖZLI" mint rögzített tény (F2.1-utó-37).
-- ÚJ migráció, ADDITÍV: meglévő oszlopot nem bolygat, adatot nem mozgat.
--
-- MIÉRT: egy üres mezőnek két, gyökeresen eltérő oka lehet, és eddig
-- MEGKÜLÖNBÖZTETHETETLENEK voltak:
--   * a kinyerés nem találta meg → javítandó hiba, munkalistára való;
--   * a gyártó nem teszi közzé → nincs mit javítani, ez maga a tény.
--
-- Élesben mért eset (felhasználói ellenőrzés a gyártó oldalán, 2026-08-21): a
-- Bluefin EGYETLEN modelljénél sem közöl űrtartalmat — méretet és teherbírást
-- igen. Enélkül az oszlop nélkül mind a 15 deszkájuk örökre „hiányos" maradna,
-- a felületen pedig az űrtartalom sora egyszerűen ELTŰNIK, tehát az olvasó nem
-- tudja, hogy nem tudjuk-e, vagy nem létezik.
--
-- MIÉRT A SOR VISELI, ÉS NEM A FORRÁS: a katalógus-sor több forrásból is
-- táplálkozhat, és a megjelenítéskor nincs forrás-kapcsolat kéznél. A tény a
-- `catalog_sources.crawl_config.unpublishedFields`-ből SZÁRMAZIK (ott van az
-- indoklás is), ide a jóváhagyáskor másolódik át.
--
-- NEM feljogosítás becslésre: a hiányzó érték hiányzó marad. A geometriából
-- számolt űrtartalom KITALÁLT biztonsági adat lenne.
--
-- RLS: VÁLTOZATLAN. Ugyanaz a kurált tartalom, mint a többi boards-oszlop —
-- publikus olvasás (`boards_public_read`), írás csak moderator/admin
-- (`boards_mod_write`). Oszlop-hozzáadás nem igényel új policyt.
-- ============================================================================

alter table public.boards
  add column if not exists unpublished_fields text[] not null default '{}';

-- Csak VALÓDI spec-mezőnevek kerülhetnek bele. Elgépelt név csendben
-- hatástalan lenne: a felület nem ismerné fel, a mező meg üresen tűnne el —
-- pontosan az az állapot, amit ez az oszlop megszüntet.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'boards_unpublished_fields_known'
      and conrelid = 'public.boards'::regclass
  ) then
    alter table public.boards add constraint boards_unpublished_fields_known
      check (
        unpublished_fields <@ array[
          'volumeL', 'weightKg', 'maxLoadKg', 'thicknessCm'
        ]::text[]
      );
  end if;
end $$;

comment on column public.boards.unpublished_fields is
  'Azok a spec-mezők, amiket a GYÁRTÓ nem tesz közzé — camelCase névvel, a catalog_sources.crawl_config.unpublishedFields-ből átvéve. Az itt felsorolt mező üressége NEM adathiány: a felület „a gyártó nem közli" felirattal mutatja, és a hiányos-lista nem kéri számon. A Deszkaválasztó az űrtartalmat 2026-08-21 óta nem követeli meg (a teherbírás-vizsgálat viszont kötelező marad).';
