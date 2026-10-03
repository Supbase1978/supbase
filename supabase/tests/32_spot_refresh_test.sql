-- ============================================================================
-- RLS/RPC-teszt — spot_refresh_requests + request_spot_refresh() (kézi
-- időjárás-frissítés, 20260717099800). pgTAP.
-- A tábla policy NÉLKÜL zárt (csak a SECURITY DEFINER függvényen át érhető
-- el) — itt a tábla-zártságot és a függvény válaszait mérjük. Tranzakció +
-- rollback (nem szennyez, és a `net.http_post` esetleges sora is visszavonódik
-- — lásd a 'queued'-hez közeli megjegyzést lent).
--
-- FONTOS: a `spot_refresh_requests`-en ÉS a `spot_refresh_log`-on is
-- `revoke all` él anon/authenticated felé (lásd a migráció fejlécét) —
-- ezért MINDEN, a két táblát közvetlenül olvasó `select count(*)`/
-- `select requested_at` ellenőrzés előtt `reset role;`-lal vissza kell
-- állni superuserre, különben 42501-gyel elszáll a teszt (nem a vizsgált
-- viselkedés hibája, hanem a tesztszkripté).
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

reset role;
select is((select count(*)::int from public.spot_refresh_requests), 0,
  'request_spot_refresh: not_found ágon nem rögzít kérést');

-- ============================================================================
-- fresh — a legutóbbi snapshot 10 percnél frissebb
-- ============================================================================
insert into public.weather_snapshots (spot_id, fetched_at, source)
  values ((select id from t_spot), now(), 'open-meteo');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(
  public.request_spot_refresh((select id from t_spot)),
  'fresh',
  'request_spot_refresh: 10 percnél frissebb snapshotra fresh');

reset role;
select is((select count(*)::int from public.spot_refresh_requests), 0,
  'request_spot_refresh: fresh ágon sem rögzít kérést');

-- ============================================================================
-- unavailable — a snapshot elavult, Vault-kulcs helyben nincs beállítva
-- (a lokális/CI stackben nincs `edge_invoke_key` secret — éles sajátosság).
-- ============================================================================
update public.weather_snapshots set fetched_at = now() - interval '1 hour'
  where spot_id = (select id from t_spot);

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(
  public.request_spot_refresh((select id from t_spot)),
  'unavailable',
  'request_spot_refresh: elavult snapshotra, Vault-kulcs nélkül unavailable (nincs Edge Function-hívás)');

reset role;
select is((select count(*)::int from public.spot_refresh_requests), 1,
  'request_spot_refresh: a throttle-sor a Vault-ellenőrzés ELŐTT rögzül (akkor is korlátoz, ha a kulcs hiányzik)');

-- ============================================================================
-- throttled — ugyanarra a spotra azonnali ismétlés; a requested_at NEM
-- változik (a 2. sor sem keletkezik — ugyanaz a spot_id a primary key).
-- ============================================================================
create temporary table t_requested_before_throttle on commit drop as
  select requested_at from public.spot_refresh_requests where spot_id = (select id from t_spot);

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(
  public.request_spot_refresh((select id from t_spot)),
  'throttled',
  'request_spot_refresh: 10 percen belüli ismételt kérésre throttled');

reset role;
select is((select count(*)::int from public.spot_refresh_requests), 1,
  'request_spot_refresh: throttled ágon NEM frissíti a requested_at-ot (nincs 2. sor sem)');
select is(
  (select requested_at from public.spot_refresh_requests where spot_id = (select id from t_spot)),
  (select requested_at from t_requested_before_throttle),
  'request_spot_refresh: throttled ágon a requested_at értéke bit-pontosan változatlan marad');

-- ============================================================================
-- lejárat — a requested_at-ot superuserként a küszöbön (10 perc) kívülre
-- állítva a következő hívás ÚJRA rögzít (helyben 'unavailable', mert nincs
-- Vault-kulcs — de a throttle-sor requested_at mezője frissül).
-- ============================================================================
update public.spot_refresh_requests set requested_at = now() - interval '11 minutes'
  where spot_id = (select id from t_spot);

create temporary table t_requested_before_expiry on commit drop as
  select requested_at from public.spot_refresh_requests where spot_id = (select id from t_spot);

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(
  public.request_spot_refresh((select id from t_spot)),
  'unavailable',
  'request_spot_refresh: lejárt throttle-ablak után a kérés újra megpróbálja (unavailable, mert nincs Vault-kulcs)');

reset role;
select is((select count(*)::int from public.spot_refresh_requests), 1,
  'request_spot_refresh: lejárat után sem keletkezik 2. sor (upsert ugyanarra a spot_id-ra)');
select cmp_ok(
  (select requested_at from public.spot_refresh_requests where spot_id = (select id from t_spot)),
  '>',
  (select requested_at from t_requested_before_expiry),
  'request_spot_refresh: lejárat után a requested_at frissül (a kérés valóban újra rögzült)');

-- ============================================================================
-- spot_refresh_log — ugyanúgy zárt, mint a spot_refresh_requests (policy
-- nélkül, revoke all anon/authenticated felé).
-- ============================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select throws_ok(
  $$ select * from public.spot_refresh_log $$, '42501', NULL,
  'spot_refresh_log: anon nem olvashatja közvetlenül (RLS, policy nélkül)');
select throws_ok(
  $$ insert into public.spot_refresh_log (spot_id) values ((select id from t_spot)) $$,
  '42501', NULL,
  'spot_refresh_log: anon nem írhat közvetlenül');

reset role;
select set_config('request.jwt.claims','', true);

-- ============================================================================
-- globális korlát — 120/óra összesen, a `spot_refresh_log` append-only napló
-- alapján számolva (a spotonkénti upsert ELŐTT ellenőrzött, lásd a migráció
-- `v_global_hourly_limit`-jét). A `spot_refresh_requests` PRIMARY KEY-je
-- spot_id, tehát spotonként csak EGY sort tart — ezért a fixtúra a NAPLÓBA ír
-- 120 friss sort (akár ugyanarra a spotra is), majd egy ÚJ, eddig soha nem
-- kért spotra a hívás a globális korlát miatt throttled — annak ellenére,
-- hogy a spot saját 10 perces ablaka üres lenne.
-- ============================================================================
insert into public.spot_refresh_log (spot_id, requested_at)
  select (select id from t_spot), now() from generate_series(1, 120);

-- Egy MÁSIK új spot, aminek SE snapshotja, SE throttle-sora, SE napló-sora
-- nincs — kizárólag a globális korlát miatt kell throttled-nek lennie.
create temporary table t_global_limit_spot on commit drop as
  select gen_random_uuid() as id;

insert into public.spots (id, name, slug, water_type, geom)
  select id, 'Globális korlát teszt — új spot', jsonb_build_object('hu','uj-spot','en','new-spot'),
         'to', ST_SetSRID(ST_MakePoint(19.0, 47.0), 4326)
  from t_global_limit_spot;

grant select on t_global_limit_spot to anon, authenticated;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(
  public.request_spot_refresh((select id from t_global_limit_spot)),
  'throttled',
  'request_spot_refresh: a globális 120/óra korlát elérésekor throttled, egy addig sosem kért spotra is');

reset role;
select is(
  (select count(*)::int from public.spot_refresh_requests where spot_id = (select id from t_global_limit_spot)),
  0,
  'request_spot_refresh: a globális korlát a spotonkénti upsert ELŐTT fut — a kizárt spotra nem keletkezik throttle-sor');
select is(
  (select count(*)::int from public.spot_refresh_log where spot_id = (select id from t_global_limit_spot)),
  0,
  'request_spot_refresh: a globális korlát miatt kizárt kérésről napló-sor sem keletkezik');

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
