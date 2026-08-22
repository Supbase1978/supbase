-- ============================================================================
-- MODUL: catalog — TÖBB KATEGÓRIA egy deszkán (F2.1-utó-41).
-- ÚJ migráció, ADDITÍV: a `board_type` oszlophoz NEM nyúl, adatot nem töröl.
--
-- MIÉRT: a gyártók NEM jelölnek ki fő kategóriát — okkal ajánlanak egy deszkát
-- több felhasználásra (felhasználói döntés, 2026-08-21). Ezt öt forráson
-- mértük, és mindegyiknél MI találtunk ki egy „fő" kategóriát, hogy elférjen
-- az egyértékű oszlopban:
--
--   * Gladiator — 82 termékből 25 több aktivitás-kategóriában is szerepel; a
--     receptünk szó szerint azt írja, hogy „ott a gyártó sem dönt", és mind a
--     25-öt KIHAGYTUK. Ez a márka katalógusának ~30%-a.
--   * Starboard — a Whopper `all-round / wave` ÉS `surf` kollekcióban is; a
--     szabályunk: „az ELSŐ egyezés nyer".
--   * Fanatic — a termékfejléc `ALL-AROUND / WINDSURF`, `TOURING / FREERACING`
--     alakú: a gyártó KETTŐT mond, mi az elsőt vettük.
--   * Jobe — „Ideal for both all-around paddling and touring".
--   * Zray — a Flora KÉT kategóriában szerepel a saját taxonómiájában.
--
-- A `board_type` egyértékűsége tehát a MI korlátunk volt, nem a piacé.
--
-- MIÉRT MARAD A `board_type`: átmenetnek. A Deszkaválasztó, a katalógus-lista
-- és a szűrők lépésenként állnak át, piros CI nélkül; addig a `board_types`
-- ELSŐ eleme és a `board_type` együtt mozog. A `board_type` eltávolítása külön
-- migráció lesz, ha már senki nem olvassa.
--
-- RLS: VÁLTOZATLAN. Ugyanaz a kurált tartalom, mint a többi boards-oszlop —
-- publikus olvasás (`boards_public_read`), írás csak moderator/admin
-- (`boards_mod_write`). Oszlop-hozzáadás nem igényel új policyt.
-- ============================================================================

alter table public.boards
  add column if not exists board_types text[] not null default '{}';

-- Csak VALÓS deszkatípus kerülhet bele, ugyanaz a készlet, mint a
-- `board_type` CHECK-kényszeréé. Elgépelt érték csendben láthatatlan lenne:
-- a Deszkaválasztó nem illesztené, a felület nem mutatná.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'boards_board_types_known' and conrelid = 'public.boards'::regclass
  ) then
    alter table public.boards add constraint boards_board_types_known
      check (
        board_types <@ array[
          'allround', 'touring', 'race', 'yoga', 'fishing', 'river', 'kids'
        ]::text[]
      );
  end if;
end $$;

-- BACKFILL: a meglévő egyértékű besorolás lesz a halmaz első (és egyetlen)
-- eleme. Csak az ÜRES tömböket tölti, tehát újrafuttatható.
update public.boards
   set board_types = array[board_type]
 where board_type is not null
   and board_types = '{}';

-- A deszka MINDIG viseljen legalább egy kategóriát, ha a `board_type` megvan.
-- (Kategória nélküli sor továbbra is lehetséges — az a moderátor dolga.)
create index if not exists boards_board_types_idx on public.boards using gin (board_types);

comment on column public.boards.board_types is
  'A deszka ÖSSZES használati kategóriája, egyenrangúan — nincs kijelölt fő kategória, mert a gyártók sem jelölnek ki (öt forráson mérve, 2026-08-21). A `board_type` az átmenet idejére megmarad, és a tömb ELSŐ elemével azonos. A Deszkaválasztó cél-illesztése erre a tömbre megy: egy „allround + touring" deszka mindkét célnál előjön, de a tisztán illeszkedő megelőzi.';
