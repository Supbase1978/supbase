-- ============================================================================
-- RLS-teszt — advisor_weights, advisor_sessions, weather_snapshots, orders,
-- push_subscriptions. pgTAP.
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111','authenticated','authenticated','user1@test.dev',  now()),
  ('44444444-4444-4444-4444-444444444444','authenticated','authenticated','admin@test.dev',  now()),
  ('55555555-5555-5555-5555-555555555555','authenticated','authenticated','user2@test.dev',  now());
update public.profiles set role='admin' where id='44444444-4444-4444-4444-444444444444';
alter table public.profiles enable trigger protect_profile_columns_trg;

-- Fixtúrák (superuser).
select set_config('request.jwt.claims','', true);
insert into public.weather_snapshots (spot_id, wind_kmh, storm_level, source)
  values ('d0000001-0000-0000-0000-000000000000', 12, 0, 'test');
insert into public.advisor_sessions (id, user_id, inputs, results) values
  ('a5000001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','{}'::jsonb,'[]'::jsonb),
  ('a5000002-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','{}'::jsonb,'[]'::jsonb);
insert into public.orders (id, user_id, kind) values
  ('40000002-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','subscription');

-- ===========================================================================
-- advisor_weights — publikus olvasás, admin írás
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select cmp_ok((select count(*)::int from public.advisor_weights), '>=', 30, 'advisor_weights: anon publikus olvasás (seed konfig)');
select is((select value from public.advisor_weights where key='advisor.weight.stability'), 30::numeric,
  'advisor_weights: seed stability súly = 30');

-- Sima user UPDATE-je: az admin_write USING(is_admin()) kiszűri a sorokat → 0 sor
-- módosul, kivétel NÉLKÜL (nem throws_ok!). A boards-mintát követve ellenőrizzük,
-- hogy az érték változatlan maradt.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update public.advisor_weights set value=999 where key='advisor.weight.stability';
reset role;
select set_config('request.jwt.claims','', true);
select is((select value from public.advisor_weights where key='advisor.weight.stability'), 30::numeric,
  'advisor_weights: sima user UPDATE-je nem hat (RLS deny, 0 sor)');

select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$ insert into public.advisor_weights (key, value) values ('supindex.custom.test', 1) $$,
  'advisor_weights: admin hangolhat (deploy nélkül)');

-- ===========================================================================
-- advisor_sessions — anon insert (anonim mérés), select csak saját + admin
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select lives_ok($$ insert into public.advisor_sessions (inputs, results) values ('{}'::jsonb,'[]'::jsonb) $$,
  'advisor_sessions: anon anonim mérést menthet (user_id null)');
select is((select count(*)::int from public.advisor_sessions), 0,
  'advisor_sessions: anon NEM olvashat vissza (nincs select policy)');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.advisor_sessions (user_id, inputs, results)
  values ('11111111-1111-1111-1111-111111111111','{}'::jsonb,'[]'::jsonb) $$,
  'advisor_sessions: user menthet saját user_id-vel');
select throws_ok($$ insert into public.advisor_sessions (user_id, inputs, results)
  values ('55555555-5555-5555-5555-555555555555','{}'::jsonb,'[]'::jsonb) $$, '42501', NULL,
  'advisor_sessions: user NEM menthet más user_id-jével');
select is((select count(*)::int from public.advisor_sessions where id='a5000002-0000-0000-0000-000000000000'), 0,
  'advisor_sessions: user NEM látja más session-jét');
select is((select count(*)::int from public.advisor_sessions where id='a5000001-0000-0000-0000-000000000000'), 1,
  'advisor_sessions: user látja a sajátját');

select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from public.advisor_sessions where id in ('a5000001-0000-0000-0000-000000000000','a5000002-0000-0000-0000-000000000000')), 2,
  'advisor_sessions: admin mindet látja');

-- ===========================================================================
-- weather_snapshots — publikus olvasás, írás CSAK service_role (deny mindenki mást)
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select cmp_ok((select count(*)::int from public.weather_snapshots), '>=', 1, 'weather: anon publikus olvasás');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok($$ insert into public.weather_snapshots (spot_id, source) values ('d0000001-0000-0000-0000-000000000000','hack') $$, '42501', NULL,
  'weather: még admin sem írhat (csak service_role, nincs policy)');

-- ===========================================================================
-- orders — csak saját sor (+admin)
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.orders (user_id, kind) values ('11111111-1111-1111-1111-111111111111','booking') $$,
  'orders: user létrehozhat saját rendelést');
select throws_ok($$ insert into public.orders (user_id, kind) values ('55555555-5555-5555-5555-555555555555','booking') $$, '42501', NULL,
  'orders: user NEM hozhat létre rendelést más nevében');
select is((select count(*)::int from public.orders where id='40000002-0000-0000-0000-000000000000'), 0, 'orders: user NEM látja más rendelését');

select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from public.orders where id='40000002-0000-0000-0000-000000000000'), 1, 'orders: admin látja mások rendelését');

-- --- Column-védelem: fizetési status + provider_ref (protect_order_columns) ---
-- User insertkor 'paid'-et és provider_ref-et próbál → a trigger biztonságos defaultra
-- kényszeríti (status='pending', provider_ref=null); nem dob hibát.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.orders (id, user_id, kind, status, provider_ref)
  values ('40000003-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','booking','paid','pi_hamis') $$,
  'orders: user insertje lefut');
reset role;
select set_config('request.jwt.claims','', true);
select is((select status from public.orders where id='40000003-0000-0000-0000-000000000000'), 'pending',
  'orders: user NEM állíthat status=paid-et insertkor (pending-re kényszerül)');
select is((select provider_ref from public.orders where id='40000003-0000-0000-0000-000000000000'), null::text,
  'orders: user NEM adhat meg provider_ref-et insertkor (null-ra kényszerül)');

-- User update-je a saját orderjén a status-t nem léptetheti (old megőrizve).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ update public.orders set status='paid', amount_huf=1 where id='40000003-0000-0000-0000-000000000000' $$,
  'orders: user update-je lefut (RLS engedi a saját sort)');
reset role;
select set_config('request.jwt.claims','', true);
select is((select status from public.orders where id='40000003-0000-0000-0000-000000000000'), 'pending',
  'orders: user NEM léptetheti a status-t update-tel (column-védelem)');

-- Admin VISZONT beállíthatja a status=paid-et és a provider_ref-et.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$ update public.orders set status='paid', provider_ref='pi_valodi'
  where id='40000003-0000-0000-0000-000000000000' $$, 'orders: admin update-je lefut');
reset role;
select set_config('request.jwt.claims','', true);
select is((select status from public.orders where id='40000003-0000-0000-0000-000000000000'), 'paid',
  'orders: admin beállíthatja a status=paid-et');
select is((select provider_ref from public.orders where id='40000003-0000-0000-0000-000000000000'), 'pi_valodi',
  'orders: admin beállíthatja a provider_ref-et');

-- service_role szintén privilegizált író (Edge Function / Stripe-webhook szimuláció).
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}', true);
select lives_ok($$ update public.orders set status='refunded' where id='40000003-0000-0000-0000-000000000000' $$,
  'orders: service_role léptetheti a status-t');
reset role;
select set_config('request.jwt.claims','', true);
select is((select status from public.orders where id='40000003-0000-0000-0000-000000000000'), 'refunded',
  'orders: service_role beállíthatta a status=refunded-et');

-- ===========================================================================
-- push_subscriptions — kizárólag saját
-- ===========================================================================
select set_config('request.jwt.claims','', true);
reset role;
insert into public.push_subscriptions (id, user_id, platform, token)
  values ('90000002-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','webpush','{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.push_subscriptions (id, user_id, platform, token)
  values ('90000001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','webpush','{}'::jsonb) $$,
  'push: user létrehozhat saját feliratkozást');
select throws_ok($$ insert into public.push_subscriptions (user_id, platform, token)
  values ('55555555-5555-5555-5555-555555555555','webpush','{}'::jsonb) $$, '42501', NULL,
  'push: user NEM iratkozhat fel más nevében');
select is((select count(*)::int from public.push_subscriptions where id='90000002-0000-0000-0000-000000000000'), 0,
  'push: user NEM látja más feliratkozását');

-- Idegen feliratkozás update-je nem hat; töröl sem.
update public.push_subscriptions set platform='fcm' where id='90000002-0000-0000-0000-000000000000';
delete from public.push_subscriptions where id='90000002-0000-0000-0000-000000000000';
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.push_subscriptions where id='90000002-0000-0000-0000-000000000000'), 1,
  'push: user NEM törölheti/módosíthatja más feliratkozását (RLS)');

select * from finish();
rollback;
