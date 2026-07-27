-- ============================================================================
-- MODUL: spots + weather — folyó-spotok vízállása (5.1/6, F1.11).
-- Additív és idempotens: meglévő oszlopot/policyt nem módosít, RLS változatlan
-- (spots és weather_snapshots publikus olvasás, írás csak service_role).
--
-- MIÉRT: a folyó-spotok SUP-indexe eddig FIX −1 büntetést kapott, függetlenül
-- attól, hogy a folyó éppen nyugodt nyári vízálláson van-e vagy árad. A
-- vizugy.hu (OVF) szolgáltatás mércénként megadja a HIVATALOS árvízvédelmi
-- készültségi szinteket (I./II./III. fok), így a korrekció hatósági küszöbre
-- épül, nem általunk kitalált cm-sávokra.
--
-- A KÜSZÖBÖKET SZÁNDÉKOSAN NEM TÁROLJUK: a mérce-törzsadat a forrásnál él és
-- ott is változhat (mederrendezés, mérce-áthelyezés). Egy lemásolt küszöb
-- csendben elavulna — a szinkron minden futáskor a friss törzsadatot olvassa.
-- ============================================================================

-- 1) A spot → vízmérce hozzárendelés (vizugy törzsszám).
alter table public.spots
  add column if not exists vizugy_tsz int;

comment on column public.spots.vizugy_tsz is
  'vizugy.hu vízmérce törzsszáma (Tsz) a folyó-spotokhoz. NULL = nincs mérce (nincs vízállás-korrekció). A mérce folyójának EGYEZNIE kell a spotéval — a legközelebbi mérce gyakran másik vízfolyáson van.';

-- 2) A mért vízállás a snapshotban.
alter table public.weather_snapshots
  add column if not exists water_level_cm int,
  add column if not exists water_level_at timestamptz,
  add column if not exists water_trend text,
  add column if not exists river_alert_level int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weather_snapshots_water_trend_check'
  ) then
    alter table public.weather_snapshots
      add constraint weather_snapshots_water_trend_check
      check (water_trend is null or water_trend in ('rising', 'falling', 'stable'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'weather_snapshots_river_alert_level_check'
  ) then
    alter table public.weather_snapshots
      add constraint weather_snapshots_river_alert_level_check
      check (river_alert_level is null or river_alert_level between 0 and 3);
  end if;
end $$;

comment on column public.weather_snapshots.water_level_cm is
  'Vízállás cm-ben a spothoz rendelt mércén (vizugy). NULL: nem folyó-spot, vagy nem érkezett mérés.';
comment on column public.weather_snapshots.water_level_at is
  'A vízállás-MÉRÉS ideje (a mércék óránként jelentenek) — nem a mi lekérésünk ideje.';
comment on column public.weather_snapshots.river_alert_level is
  'Árvízvédelmi készültségi fok (0=nincs, 1/2/3 = I./II./III.) a mérce HIVATALOS küszöbeiből számolva. NULL = nincs adat, ami NEM egyenlő a 0-val.';

-- 3) A legfrissebb-snapshot nézet bővítése (a lista/adatlap innen olvas).
create or replace view public.latest_weather_snapshots
with (security_invoker = on) as
select distinct on (spot_id)
  spot_id,
  fetched_at,
  observed_at,
  wind_kmh,
  gust_kmh,
  wind_dir_deg,
  water_temp_c,
  air_temp_c,
  wave_cm,
  storm_level,
  sup_index,
  source,
  water_level_cm,
  water_level_at,
  water_trend,
  river_alert_level
from public.weather_snapshots
order by spot_id, fetched_at desc;

grant select on public.latest_weather_snapshots to anon, authenticated;

-- 4) A három seedelt folyó-spot mércéje. A párosítás koordináta-közelség ÉS
--    folyó-egyezés alapján készült (2026-07-27):
--      Szeged (Tisza)        → 2275 Szeged,   Tisza,        0,4 km
--      Győr (Mosoni-Duna)    →   18 Bácsa,    Mosoni-Duna,  5,2 km
--        (a 0,3 km-re lévő „Győr" mérce a RÁBÁN van — más vízfolyás!)
--      Római-part (Duna)     → 1026 Budapest, Duna,         8,7 km
--        (a közelebbi Óbuda mércének NINCSENEK készültségi szintjei)
update public.spots set vizugy_tsz = 2275 where slug->>'hu' = 'szeged-tisza';
update public.spots set vizugy_tsz =   18 where slug->>'hu' = 'gyor-mosoni-duna';
update public.spots set vizugy_tsz = 1026 where slug->>'hu' = 'romai-part';
