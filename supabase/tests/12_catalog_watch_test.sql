-- ============================================================================
-- RLS-teszt — catalog-watch (catalog_sources / catalog_candidates + boards-
-- életciklus). pgTAP. A catalog-watch táblák KURÁLT/BELSŐ tartalom: select ÉS
-- write csak moderator/admin; anon és sima user semmit nem lát/ír belőlük.
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111','authenticated','authenticated','user1@test.dev', now()),
  ('33333333-3333-3333-3333-333333333333','authenticated','authenticated','mod@test.dev',   now());
update public.profiles set role='moderator' where id='33333333-3333-3333-3333-333333333333';
alter table public.profiles enable trigger protect_profile_columns_trg;

-- --- boards életciklus-mezők (default a meglévő seed sorokon) ----------------
reset role;
select set_config('request.jwt.claims','', true);
select is((select status from public.boards where id='b0000001-0000-0000-0000-000000000000'), 'active',
  'boards.status default active a meglévő sorokon');
select ok((select first_seen_at is not null from public.boards where id='b0000001-0000-0000-0000-000000000000'),
  'boards.first_seen_at kitöltve (default now())');

-- --- Moderator: írhat ÉS olvashat -------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ insert into public.catalog_sources (id, name, kind)
                   values ('c5000001-0000-0000-0000-000000000000','Teszt Forrás','shop') $$,
  'catalog_sources: moderator beszúrhat');
select lives_ok($$ insert into public.catalog_candidates (source_id, url, status)
                   values ('c5000001-0000-0000-0000-000000000000','https://x.dev/board','pending') $$,
  'catalog_candidates: moderator beszúrhat');
select cmp_ok((select count(*)::int from public.catalog_sources),    '>=', 1, 'catalog_sources: moderator olvas');
select cmp_ok((select count(*)::int from public.catalog_candidates), '>=', 1, 'catalog_candidates: moderator olvas');

-- --- Sima user: NEM olvas (RLS → 0 sor) és NEM ír (42501) --------------------
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.catalog_sources),    0, 'catalog_sources: sima user NEM olvas (RLS deny)');
select is((select count(*)::int from public.catalog_candidates), 0, 'catalog_candidates: sima user NEM olvas (RLS deny)');
select throws_ok($$ insert into public.catalog_sources (name, kind) values ('Kamu','shop') $$, '42501', NULL,
  'catalog_sources: sima user NEM szúrhat be (RLS)');
select throws_ok($$ insert into public.catalog_candidates (source_id)
                    values ('c5000001-0000-0000-0000-000000000000') $$, '42501', NULL,
  'catalog_candidates: sima user NEM szúrhat be (RLS)');

-- --- Anon: NEM olvas, NEM ír -------------------------------------------------
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is((select count(*)::int from public.catalog_sources), 0, 'catalog_sources: anon NEM olvas');
select throws_ok($$ insert into public.catalog_sources (name, kind) values ('Anon','shop') $$, '42501', NULL,
  'catalog_sources: anon NEM szúrhat be');

reset role;
select set_config('request.jwt.claims','', true);
select * from finish();
rollback;
