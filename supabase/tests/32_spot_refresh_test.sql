-- ============================================================================
-- RLS/RPC-teszt — spot_refresh_requests + request_spot_refresh() (kézi
-- időjárás-frissítés, 20260717099800). pgTAP.
-- A tábla policy NÉLKÜL zárt (csak a SECURITY DEFINER függvényen át érhető
-- el) — itt a tábla-zártságot és a függvény válaszait mérjük. Tranzakció +
-- rollback (nem szennyez, és a `net.http_post` esetleges sora is visszavonódik
-- — lásd a 'queued'-hez közeli megjegyzést lent).
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

-- --- Fixtúrák (superuser) ---------------------------------------------------
alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('c1111111-1111-1111-1111-111111111111','authenticated','authenticated','refresh-user@test.dev', now());
alter table public.profiles enable trigger protect_profile_columns_trg;

-- Egy valódi spot a seedből — a `spots` olvasása publikus, ezért a saját
-- RLS alatt (anon/authenticated) is elérhető, nem kell temp-tábla trükk.
create temporary table t_spot on commit drop as
  select id from public.spots limit 1;
grant select on t_spot to anon, authenticated;

-- ============================================================================
-- A tábla zárt: SEM anon, SEM bejelentkezett user nem éri el közvetlenül.
-- ============================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select throws_ok(
  $$ select * from public.spot_refresh_requests $$, '42501', NULL,
  'spot_refresh_requests: anon nem olvashatja közvetlenül (RLS, policy nélkül)');
select throws_ok(
  $$ insert into public.spot_refresh_requests (spot_id) values ((select id from t_spot)) $$,
  '42501', NULL,
  'spot_refresh_requests: anon nem írhat közvetlenül');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$ select * from public.spot_refresh_requests $$, '42501', NULL,
  'spot_refresh_requests: bejelentkezett user sem olvashatja közvetlenül');
select throws_ok(
  $$ insert into public.spot_refresh_requests (spot_id) values ((select id from t_spot)) $$,
  '42501', NULL,
  'spot_refresh_requests: bejelentkezett user sem írhat közvetlenül');

reset role;
select set_config('request.jwt.claims','', true);

-- ============================================================================
-- request_spot_refresh — not_found
-- ============================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(
  public.request_spot_refresh('00000000-0000-0000-0000-000000000000'),
  'not_found',
  'request_spot_refresh: nem létező spotra not_found');
select is((select count(*)::int from public.spot_refresh_requests), 0,
  'request_spot_refresh: not_found ágon nem rögzít kérést');

-- ============================================================================
-- fresh — a legutóbbi snapshot 10 percnél frissebb
-- ============================================================================
reset role;
insert into public.weather_snapshots (spot_id, fetched_at, source)
  values ((select id from t_spot), now(), 'open-meteo');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(
  public.request_spot_refresh((select id from t_spot)),
  'fresh',
  'request_spot_refresh: 10 percnél frissebb snapshotra fresh');
select is((select count(*)::int from public.spot_refresh_requests), 0,
  'request_spot_refresh: fresh ágon sem rögzít kérést');

-- ============================================================================
-- unavailable — a snapshot elavult, Vault-kulcs helyben nincs beállítva
-- (a lokális/CI stackben nincs `edge_invoke_key` secret — éles sajátosság).
-- ============================================================================
reset role;
update public.weather_snapshots set fetched_at = now() - interval '1 hour'
  where spot_id = (select id from t_spot);

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(
  public.request_spot_refresh((select id from t_spot)),
  'unavailable',
  'request_spot_refresh: elavult snapshotra, Vault-kulcs nélkül unavailable (nincs Edge Function-hívás)');
select is((select count(*)::int from public.spot_refresh_requests), 1,
  'request_spot_refresh: a throttle-sor a Vault-ellenőrzés ELŐTT rögzül (akkor is korlátoz, ha a kulcs hiányzik)');

-- ============================================================================
-- throttled — ugyanarra a spotra azonnali ismétlés
-- ============================================================================
select is(
  public.request_spot_refresh((select id from t_spot)),
  'throttled',
  'request_spot_refresh: 10 percen belüli ismételt kérésre throttled');
select is((select count(*)::int from public.spot_refresh_requests), 1,
  'request_spot_refresh: throttled ágon NEM frissíti a requested_at-ot (nincs 2. sor sem)');

reset role;
select set_config('request.jwt.claims','', true);

-- ============================================================================
-- Jogosultság: mindkét szerep hívhatja az RPC-t (a throttle véd, nem a login).
-- ============================================================================
select ok(has_function_privilege('anon', 'public.request_spot_refresh(uuid)', 'execute'),
  'request_spot_refresh: anonnak VAN EXECUTE joga');
select ok(has_function_privilege('authenticated', 'public.request_spot_refresh(uuid)', 'execute'),
  'request_spot_refresh: authenticatednek VAN EXECUTE joga');

select * from finish();
rollback;
