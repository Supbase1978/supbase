-- ============================================================================
-- RLS-teszt — catalog (brands / boards / board_prices). pgTAP.
-- Publikus olvasás; írás csak moderator/admin. Seed adat jelen van (read-hoz).
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111','authenticated','authenticated','user1@test.dev', now()),
  ('33333333-3333-3333-3333-333333333333','authenticated','authenticated','mod@test.dev',   now()),
  ('44444444-4444-4444-4444-444444444444','authenticated','authenticated','admin@test.dev', now());
update public.profiles set role='moderator' where id='33333333-3333-3333-3333-333333333333';
update public.profiles set role='admin'     where id='44444444-4444-4444-4444-444444444444';
alter table public.profiles enable trigger protect_profile_columns_trg;

-- --- Publikus olvasás (anon) ------------------------------------------------
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select cmp_ok((select count(*)::int from public.brands),       '>=', 9,  'brands: anon publikus olvasás');
select cmp_ok((select count(*)::int from public.boards),       '>=', 20, 'boards: anon publikus olvasás');
select cmp_ok((select count(*)::int from public.board_prices), '>=', 20, 'board_prices: anon publikus olvasás');

-- --- Írás: sima user NEM (RLS deny) -----------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ insert into public.brands (name) values ('Kamu Márka') $$, '42501', NULL,
  'brands: sima user NEM szúrhat be (RLS)');
select throws_ok($$ insert into public.board_prices (board_id, shop_name, price_huf)
                    values ('b0000001-0000-0000-0000-000000000000','Kamu Bolt', 1) $$, '42501', NULL,
  'board_prices: sima user NEM szúrhat be (RLS)');

-- --- Írás: moderator IGEN ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ insert into public.brands (name) values ('Moderátor Márka') $$,
  'brands: moderator beszúrhat');
select lives_ok($$ insert into public.board_prices (board_id, shop_name, price_huf)
                   values ('b0000001-0000-0000-0000-000000000000','Mod Bolt', 399000) $$,
  'board_prices: moderator beszúrhat');

-- --- Írás: admin IGEN (board) -----------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$ insert into public.boards (brand_id, model_name, slug, board_type)
                   values ((select id from public.brands where name='Red Paddle Co'),
                           'Admin Teszt', '{"hu":"admin-teszt","en":"admin-test"}', 'allround') $$,
  'boards: admin beszúrhat');

-- --- User update NEM hat (RLS → 0 sor) --------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update public.boards set model_name='Eltérített' where id='b0000001-0000-0000-0000-000000000000';
reset role;
select set_config('request.jwt.claims','', true);
select isnt((select model_name from public.boards where id='b0000001-0000-0000-0000-000000000000'), 'Eltérített',
  'boards: sima user update-je nem hat (RLS)');

-- --- Anon írás TILOS (a mod_write policy `to authenticated` → anon default deny) ---
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select throws_ok($$ insert into public.brands (name) values ('Anon Márka') $$, '42501', NULL,
  'brands: anon NEM szúrhat be (nincs policy → deny)');

-- --- DELETE-ág (brands_mod_write FOR ALL) -----------------------------------
-- Sima user NEM törölheti a mod által beszúrt márkát (RLS → 0 sor).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
delete from public.brands where name='Moderátor Márka';
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.brands where name='Moderátor Márka'), 1,
  'brands: sima user NEM törölhet márkát (RLS deny, 0 sor)');

-- Moderator törölheti.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ delete from public.brands where name='Moderátor Márka' $$,
  'brands: moderator törölhet márkát');
reset role;
select set_config('request.jwt.claims','', true);

select * from finish();
rollback;
