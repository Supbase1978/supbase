-- ============================================================================
-- RLS-teszt — analytics_events (F1.12). pgTAP.
--
-- A tábla különleges: SENKI nem írhat rá közvetlenül (nincs insert-policy), az
-- egyetlen írási út a `record_analytics_event()` definer-függvény. Olvasni
-- pedig csak admin tud. A tesztek mindkét irányt ellenőrzik, mert egy hiányzó
-- policy itt CSENDES hiba lenne: az események egyszerűen nem keletkeznének.
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('61111111-1111-1111-1111-111111111111','authenticated','authenticated','anal-user@test.dev', now()),
  ('64444444-4444-4444-4444-444444444444','authenticated','authenticated','anal-admin@test.dev', now());
update public.profiles set role='admin' where id='64444444-4444-4444-4444-444444444444';
alter table public.profiles enable trigger protect_profile_columns_trg;

-- ===========================================================================
-- Írás: KIZÁRÓLAG a definer-függvényen át
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);

select throws_ok(
  $$ insert into public.analytics_events (name, path) values ('page_view','/x') $$,
  '42501', NULL,
  'analytics: anon KÖZVETLENÜL nem írhat a táblába');

select lives_ok(
  $$ select public.record_analytics_event('page_view', '/spotok') $$,
  'analytics: anon a definer-függvényen KERESZTÜL rögzíthet eseményt');

-- Ismeretlen eseménynév: nem hiba, de nem is keletkezik sor.
select lives_ok(
  $$ select public.record_analytics_event('kamu_esemeny', '/spotok') $$,
  'analytics: ismeretlen eseménynév nem dob kivételt');

-- A query-rész levágása: a megosztott advisor-link TESTSÚLYT tartalmaz, annak
-- a statisztikában nincs helye.
select lives_ok(
  $$ select public.record_analytics_event('advisor_result_view', '/deszkavalaszto?suly=85&magassag=180') $$,
  'analytics: query-s útvonal is elfogadható bemenet');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.analytics_events (name) values ('page_view') $$,
  '42501', NULL,
  'analytics: bejelentkezett user sem írhat közvetlenül');

-- ===========================================================================
-- Olvasás: csak admin
-- ===========================================================================
select is((select count(*)::int from public.analytics_events), 0,
  'analytics: sima user egyetlen eseményt sem lát');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is((select count(*)::int from public.analytics_events), 0,
  'analytics: anon sem lát eseményt');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"64444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select cmp_ok((select count(*)::int from public.analytics_events), '>=', 2,
  'analytics: admin látja a rögzített eseményeket');
select is(
  (select path from public.analytics_events where name = 'advisor_result_view' limit 1),
  '/deszkavalaszto',
  'analytics: a query-rész (testsúly!) NEM kerül tárolásra');
select is(
  (select count(*)::int from public.analytics_events where name = 'kamu_esemeny'),
  0,
  'analytics: ismeretlen eseménynévből NEM keletkezik sor');

-- A napi nézet is admin-jogon olvas (security_invoker).
select cmp_ok((select count(*)::int from public.analytics_daily), '>=', 1,
  'analytics_daily: admin számára olvasható');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is((select count(*)::int from public.analytics_daily), 0,
  'analytics_daily: anon számára üres (a nézet nem kerüli meg az RLS-t)');

-- ===========================================================================
-- Értékkészlet-kényszerek (a definer-függvény megkerülése nélkül is védenek)
-- ===========================================================================
reset role;
select set_config('request.jwt.claims','', true);
select throws_ok(
  $$ insert into public.analytics_events (name) values ('valami_mas') $$,
  '23514', NULL,
  'analytics: ismeretlen eseménynév kényszer-hibát ad service_role alatt is');
select throws_ok(
  $$ insert into public.analytics_events (name, path) values ('page_view', 'nem-per-jellel-kezdodik') $$,
  '23514', NULL,
  'analytics: hibás alakú útvonal elutasítva');

select * from finish();
rollback;
