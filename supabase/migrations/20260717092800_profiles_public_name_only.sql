-- ============================================================================
-- CORE: a `profiles` publikus olvasása CSAK A NÉVRE szűkül (F2.4-02).
--
-- MIÉRT: a `profiles_public_read` policy `using (true)` volt, tehát anonim
-- kulccsal MINDEN oszlop olvasható volt: `role`, `rider_weight_kg`,
-- `experience`, `locale`, `created_at`. Élesben ellenőrizve, anonim kulccsal
-- (2026-08-23).
--
-- Az eredeti döntés indoklása (20260717090200) ez volt: „a publikus oldalak a
-- szerző display_name-jét kötés nélkül renderelik. (rider_weight/experience
-- nem érzékeny; ha később az lesz, nézet mögé kerül.)" — ez a migráció épp azt
-- a megjegyzett lépést hajtja végre, két okból:
--
--   1. A TESTSÚLY GDPR-értelemben személyes adat. Ma NULLA felhasználó adta
--      meg, tehát ez a legolcsóbb pillanat: nincs mit menteni vagy migrálni.
--   2. A `role` elárulja, ki az admin. Célzott adathalászathoz ad
--      kiindulópontot, és semmilyen publikus felületnek nincs rá szüksége.
--
-- A NÉV VISZONT KELL, és ez a lényegi különbség az elzáráshoz képest: a
-- vélemények a szerző NEVE alatt jelennek meg (felhasználói döntés,
-- 2026-08-23), mert aki a saját neve alatt ír, máshogy ír — ez társas
-- visszatartó erő a gépi hozzászólások ellen.
--
-- MIÉRT NÉZET, ÉS MIÉRT NEM OSZLOP-JOGOSULTSÁG: az oszlop-szintű GRANT
-- szerepenként szól, nem soronként — így nem tudná megkülönböztetni a SAJÁT
-- sort (ahol minden oszlop kell a beállítások-oldalhoz) a többiekétől (ahol
-- csak a név szabad). A nézet ezt megoldja: két oszlopot ad mindenkiről, a
-- tábla policy-ja pedig a teljes sort csak a tulajdonosnak és a moderátornak.
-- ============================================================================

-- 1. A tábla publikus SELECT-je megszűnik.
drop policy if exists profiles_public_read on public.profiles;

do $$
begin
  -- A SAJÁT sor teljes egészében olvasható marad (beállítások-oldal).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_read'
  ) then
    create policy profiles_self_read on public.profiles
      for select to authenticated using (auth.uid() = id);
  end if;

  -- A moderátornak a teljes sor kell: jelentett vélemény kivizsgálásához
  -- tudnia kell, KI írta (`is_moderator()` — core_helpers, SECURITY DEFINER).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_mod_read'
  ) then
    create policy profiles_mod_read on public.profiles
      for select to authenticated using (public.is_moderator());
  end if;
end $$;

-- 2. A PUBLIKUS NÉZET: kizárólag azonosító + megjelenítendő név.
--
-- Az `id` azért kell, mert a vélemény `user_id`-ja ehhez kapcsolódik — e
-- nélkül a nevet nem lehetne a megfelelő véleményhez rendelni.
--
-- A nézet SZÁNDÉKOSAN a definiálója jogaival fut (nincs `security_invoker`):
-- ez az, ami átlát a `profiles` sor-szintű policy-ján, és így MINDENKI nevét
-- vissza tudja adni. Azért vállalható, mert a nézet KÉT ÁRTALMATLAN oszlopot
-- tartalmaz, és pontosan azt adja, ami a felületen amúgy is megjelenik. Ha
-- ide valaha új oszlop kerülne, az azonnal publikussá válna — ezért a nézet
-- bővítése MINDIG biztonsági döntés.
create or replace view public.profiles_public as
  select id, display_name
  from public.profiles;

comment on view public.profiles_public is
  'A profil PUBLIKUSAN vállalható része: azonosító + megjelenítendő név. A vélemények szerzőjének megjelenítéséhez kell (F2.4-02). A role, a rider_weight_kg, az experience és a locale SZÁNDÉKOSAN nincs benne — azok a tábla policy-ja mögött maradnak (saját sor + moderátor). A nézet a definiálója jogaival fut, ezért BŐVÍTÉSE mindig biztonsági döntés.';

grant select on public.profiles_public to anon, authenticated;
