-- ============================================================================
-- RLS-teszt — user_consents (F1.8). pgTAP. Append-only beleegyezés-napló.
-- Szerepek: anon / user1 / user2 / admin. Pozitív ÉS negatív esetek.
-- Tranzakció + rollback (nem szennyez).
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

-- --- Fixtúrák (superuser) ---------------------------------------------------
alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('a1111111-1111-1111-1111-111111111111','authenticated','authenticated','c-user1@test.dev', now()),
  ('a2222222-2222-2222-2222-222222222222','authenticated','authenticated','c-user2@test.dev', now()),
  ('a4444444-4444-4444-4444-444444444444','authenticated','authenticated','c-admin@test.dev', now());
update public.profiles set role='admin' where id='a4444444-4444-4444-4444-444444444444';
alter table public.profiles enable trigger protect_profile_columns_trg;

-- ===========================================================================
-- INSERT — saját beleegyezés (user1)
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.user_consents (user_id, kind, version) values ('a1111111-1111-1111-1111-111111111111','terms','2026-07') $$,
  'user_consents: user beszúrhatja a saját ÁSZF-beleegyezését');
select lives_ok(
  $$ insert into public.user_consents (user_id, kind, version) values ('a1111111-1111-1111-1111-111111111111','privacy','2026-07') $$,
  'user_consents: user beszúrhatja a saját adatvédelmi beleegyezését');

-- Duplikátum (ugyanaz a user+kind+version) → unique violation
select throws_ok(
  $$ insert into public.user_consents (user_id, kind, version) values ('a1111111-1111-1111-1111-111111111111','terms','2026-07') $$,
  '23505', null,
  'user_consents: ugyanarra a fajta+verzióra nem lehet duplikátum (unique)');

-- Más user nevében TILOS (with check user_id = auth.uid)
select throws_ok(
  $$ insert into public.user_consents (user_id, kind, version) values ('a2222222-2222-2222-2222-222222222222','terms','2026-07') $$,
  '42501', null,
  'user_consents: user NEM szúrhat be más nevében (RLS with check)');

-- ===========================================================================
-- SELECT — saját látható, idegené nem; admin mindent lát
-- ===========================================================================
select is(
  (select count(*)::int from public.user_consents where user_id='a1111111-1111-1111-1111-111111111111'),
  2, 'user_consents: user látja a saját 2 beleegyezését');

-- user2 fixtúra-sor (superuser-rel, hogy legyen mit NEM látnia user1-nek)
reset role;
select set_config('request.jwt.claims','', true);
insert into public.user_consents (user_id, kind, version) values ('a2222222-2222-2222-2222-222222222222','terms','2026-07');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.user_consents where user_id='a2222222-2222-2222-2222-222222222222'),
  0, 'user_consents: user NEM látja más beleegyezését (RLS select)');

-- Admin mindent lát
select set_config('request.jwt.claims','{"sub":"a4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select cmp_ok(
  (select count(*)::int from public.user_consents), '>=', 3,
  'user_consents: admin minden beleegyezést lát');

-- ===========================================================================
-- ANON — se olvas, se ír
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(
  (select count(*)::int from public.user_consents), 0,
  'user_consents: anon egyetlen sort sem lát');
select throws_ok(
  $$ insert into public.user_consents (user_id, kind, version) values ('a1111111-1111-1111-1111-111111111111','marketing','2026-07') $$,
  null, null,
  'user_consents: anon nem szúrhat be beleegyezést');

select * from finish();
rollback;
