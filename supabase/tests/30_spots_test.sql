-- ============================================================================
-- RLS-teszt — spots + spot_reports. pgTAP.
-- Publikus olvasás; spots kurált (mod/admin); spot_report insert = e-mail-gate + saját.
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111','authenticated','authenticated','user1@test.dev',  now()),
  ('22222222-2222-2222-2222-222222222222','authenticated','authenticated','unconf@test.dev',  null),
  ('33333333-3333-3333-3333-333333333333','authenticated','authenticated','mod@test.dev',     now()),
  ('55555555-5555-5555-5555-555555555555','authenticated','authenticated','user2@test.dev',   now());
update public.profiles set role='moderator' where id='33333333-3333-3333-3333-333333333333';
alter table public.profiles enable trigger protect_profile_columns_trg;

-- Fixtúra spot_report (user1 @ d0000001).
select set_config('request.jwt.claims','', true);
insert into public.spot_reports (id, spot_id, user_id, conditions)
values ('50000001-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','nyugodt');

-- --- spots: publikus olvasás + kurált írás -----------------------------------
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select cmp_ok((select count(*)::int from public.spots), '>=', 15, 'spots: anon publikus olvasás');
select cmp_ok((select count(*)::int from public.spot_reports), '>=', 1, 'spot_reports: anon publikus olvasás');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ insert into public.spots (name, slug, water_type, geom)
  values ('Kamu Spot','{"hu":"kamu","en":"fake"}','to', ST_SetSRID(ST_MakePoint(19,47),4326)) $$, '42501', NULL,
  'spots: sima user NEM hozhat létre spotot');

select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ insert into public.spots (name, slug, water_type, geom)
  values ('Mod Spot','{"hu":"mod-spot","en":"mod-spot"}','to', ST_SetSRID(ST_MakePoint(19,47),4326)) $$,
  'spots: moderator létrehozhat spotot');

-- --- spot_reports: e-mail-gate + tulajdon ------------------------------------
-- Megerősítetlen → tilos.
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ insert into public.spot_reports (spot_id, user_id, conditions)
  values ('d0000002-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','fodrozodo') $$, '42501', NULL,
  'spot_reports: megerősítetlen e-maillel NEM lehet jelenteni');

-- Megerősített, saját néven → OK.
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.spot_reports (spot_id, user_id, conditions)
  values ('d0000002-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','hullamzo') $$,
  'spot_reports: megerősített user jelenthet saját néven');

-- Más nevében → tilos.
select throws_ok($$ insert into public.spot_reports (spot_id, user_id, conditions)
  values ('d0000003-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','nyugodt') $$, '42501', NULL,
  'spot_reports: nem lehet más nevében jelenteni');

-- Anon → tilos.
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select throws_ok($$ insert into public.spot_reports (spot_id, user_id, conditions)
  values ('d0000001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','nyugodt') $$, '42501', NULL,
  'spot_reports: anon NEM jelenthet');

-- Idegen user update-je nem hat; a szerzőé igen.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
update public.spot_reports set note='betörés' where id='50000001-0000-0000-0000-000000000000';
reset role;
select set_config('request.jwt.claims','', true);
select is((select note from public.spot_reports where id='50000001-0000-0000-0000-000000000000'), NULL,
  'spot_reports: idegen user update-je nem hat (RLS)');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ update public.spot_reports set note='szép idő' where id='50000001-0000-0000-0000-000000000000' $$,
  'spot_reports: a szerző szerkesztheti a sajátját');

-- Moderátor törölhet bármely jelentést.
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ delete from public.spot_reports where id='50000001-0000-0000-0000-000000000000' $$,
  'spot_reports: moderátor törölhet bármely jelentést');

-- --- spots DELETE-ág (spots_mod_write FOR ALL) ------------------------------
-- Sima user NEM törölhet spotot (RLS → 0 sor).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
delete from public.spots where name='Mod Spot';
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.spots where name='Mod Spot'), 1,
  'spots: sima user NEM törölhet spotot (RLS deny, 0 sor)');

-- Moderator törölheti a saját maga által beszúrt (gyermek nélküli) spotot.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ delete from public.spots where name='Mod Spot' $$,
  'spots: moderator törölhet spotot');
reset role;
select set_config('request.jwt.claims','', true);

select * from finish();
rollback;
