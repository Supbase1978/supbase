-- ============================================================================
-- MODUL: weather — `latest_weather_snapshots` nézet (F1.4-utó follow-up).
--
-- MIÉRT: a spot-lista eddig a legutóbbi 200 snapshot-sort kérte le, és
-- JS-ben redukálta spotonkéntire. Ez a spotok/mérések számának növekedésével
-- CSENDBEN ROMLIK EL: ha 15 spot helyett 60 lesz, a 200 sor már nem feltétlen
-- fedi mindegyik spot legfrissebb mérését, és egyes spotok „nincs adat"-ként
-- jelennének meg — biztonsági felületen ez elfogadhatatlan hibamód.
--
-- A `distinct on (spot_id) ... order by spot_id, fetched_at desc` a Postgres
-- natív megoldása; a `weather_snapshots` PK-ja (spot_id, fetched_at) visszafelé
-- olvasva kiszolgálja, külön index nem kell.
--
-- RLS: `security_invoker = on` → a nézet a HÍVÓ jogaival olvas, tehát a
-- `weather_snapshots` publikus-olvasás policy-ja érvényesül (a nézet NEM
-- kerüli meg az RLS-t). Írás a nézeten keresztül nem történik.
-- ============================================================================

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
  source
from public.weather_snapshots
order by spot_id, fetched_at desc;

comment on view public.latest_weather_snapshots is
  'Spotonként a LEGFRISSEBB weather_snapshots sor. security_invoker: a hívó jogaival olvas, az alaptábla RLS-e érvényes.';

grant select on public.latest_weather_snapshots to anon, authenticated;
