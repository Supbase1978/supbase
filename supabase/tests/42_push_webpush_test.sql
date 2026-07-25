-- ============================================================================
-- RLS/RPC-teszt — push_subscriptions Web Push-bővítés (F1.9). pgTAP.
-- Fedi: generált `endpoint` oszlop, UNIQUE endpoint, upsert_push_subscription()
-- SECURITY DEFINER (saját nevében írás, eszköz-átvétel), negatív esetek.
-- Tranzakció + rollback (nem szennyez).
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

-- --- Fixtúrák (superuser) ---------------------------------------------------
alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('b1111111-1111-1111-1111-111111111111','authenticated','authenticated','p-user1@test.dev', now()),
  ('b2222222-2222-2222-2222-222222222222','authenticated','authenticated','p-user2@test.dev', now());
alter table public.profiles enable trigger protect_profile_columns_trg;

-- Két spot a seedből (bármelyik kettő) az alert_spot_ids-hez.
create temporary table t_spots on commit drop as
  select id, row_number() over (order by id) as rn from public.spots limit 2;

-- ===========================================================================
-- upsert_push_subscription — saját feliratkozás létrehozása
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ select public.upsert_push_subscription(
       '{"endpoint":"https://push.example/aaa","keys":{"p256dh":"PUB","auth":"AUTH"}}'::jsonb,
       (select array_agg(id) from t_spots)) $$,
  'push: user létrehozhatja a saját feliratkozását az RPC-vel');

select is((select count(*)::int from public.push_subscriptions), 1,
  'push: pontosan egy sor jött létre');
select is((select user_id from public.push_subscriptions), 'b1111111-1111-1111-1111-111111111111'::uuid,
  'push: a user_id a hívó (auth.uid()), nem paraméter');
select is((select endpoint from public.push_subscriptions), 'https://push.example/aaa',
  'push: az endpoint generált oszlop a tokenből képződik');
select is((select array_length(alert_spot_ids, 1) from public.push_subscriptions), 2,
  'push: a spot-lista elmentődött (explicit opt-in)');

-- ===========================================================================
-- Ismételt feliratkozás UGYANARRÓL az endpointról: frissít, nem duplikál
-- ===========================================================================
select lives_ok(
  $$ select public.upsert_push_subscription(
       '{"endpoint":"https://push.example/aaa","keys":{"p256dh":"PUB2","auth":"AUTH2"}}'::jsonb,
       (select array_agg(id) from t_spots where rn = 1)) $$,
  'push: ugyanaz az endpoint újra feliratkozhat');
select is((select count(*)::int from public.push_subscriptions), 1,
  'push: az azonos endpoint NEM duplikálódik (UNIQUE)');
select is((select token -> 'keys' ->> 'p256dh' from public.push_subscriptions), 'PUB2',
  'push: az újrafeliratkozás frissítette a kulcsokat');
select is((select array_length(alert_spot_ids, 1) from public.push_subscriptions), 1,
  'push: a spot-lista felülíródott (szűkítés)');

-- ===========================================================================
-- Negatív esetek — hibás token
-- ===========================================================================
select throws_ok(
  $$ select public.upsert_push_subscription('{"keys":{"p256dh":"P","auth":"A"}}'::jsonb, '{}'::uuid[]) $$,
  '22023', NULL, 'push: endpoint nélküli token elutasítva');
select throws_ok(
  $$ select public.upsert_push_subscription('{"endpoint":"https://push.example/bbb"}'::jsonb, '{}'::uuid[]) $$,
  '22023', NULL, 'push: kulcsok nélküli token elutasítva');

-- ===========================================================================
-- Eszköz-átvétel: ugyanaz az endpoint másik fiókkal (közös gép)
-- ===========================================================================
select set_config('request.jwt.claims','{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok(
  $$ select public.upsert_push_subscription(
       '{"endpoint":"https://push.example/aaa","keys":{"p256dh":"PUB3","auth":"AUTH3"}}'::jsonb,
       (select array_agg(id) from t_spots)) $$,
  'push: másik fiók átveheti ugyanazt a böngésző-endpointot');

reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.push_subscriptions where endpoint='https://push.example/aaa'), 1,
  'push: az átvétel után is egyetlen sor tartozik az endpointhoz');
select is((select user_id from public.push_subscriptions where endpoint='https://push.example/aaa'),
  'b2222222-2222-2222-2222-222222222222'::uuid,
  'push: az endpoint az ÚJ felhasználóhoz került (a régi sor törlődött)');

-- ===========================================================================
-- Anon nem iratkozhat fel
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select throws_ok(
  $$ select public.upsert_push_subscription(
       '{"endpoint":"https://push.example/ccc","keys":{"p256dh":"P","auth":"A"}}'::jsonb, '{}'::uuid[]) $$,
  '42501', NULL, 'push: anon NEM iratkozhat fel (nincs auth.uid())');

-- ===========================================================================
-- Leiratkozás: a user a SAJÁTJÁT törölheti endpoint alapján, a másét nem
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
delete from public.push_subscriptions where endpoint = 'https://push.example/aaa';  -- user2-é, RLS kiszűri
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.push_subscriptions where endpoint='https://push.example/aaa'), 1,
  'push: user NEM törölheti más feliratkozását endpoint alapján (RLS)');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
delete from public.push_subscriptions where endpoint = 'https://push.example/aaa';
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.push_subscriptions where endpoint='https://push.example/aaa'), 0,
  'push: a tulajdonos törölheti a saját feliratkozását (leiratkozás)');

select * from finish();
rollback;
