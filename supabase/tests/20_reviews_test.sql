-- ============================================================================
-- RLS-teszt — reviews (board_reviews + review_flags). pgTAP.
-- Kiemelt: e-mail-gate, tulajdon-ellenőrzés, verified_owner/status column-védelem,
-- moderáció, publikus olvasás csak 'published'.
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

-- Fixtúra-vélemények (superuser bypass): 1 published (user1), 1 hidden (user2).
select set_config('request.jwt.claims','', true);
insert into public.board_reviews (id, board_id, user_id, rating_overall, status) values
  ('a0000001-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111', 5, 'published'),
  ('a0000002-0000-0000-0000-000000000000','b0000002-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555', 4, 'hidden');

-- ===========================================================================
-- Publikus olvasás — csak 'published'
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is((select count(*)::int from public.board_reviews where id='a0000001-0000-0000-0000-000000000000'), 1, 'anon látja a published véleményt');
select is((select count(*)::int from public.board_reviews where id='a0000002-0000-0000-0000-000000000000'), 0, 'anon NEM látja a hidden véleményt');

-- Saját hidden vélemény a szerzőnek látszik.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.board_reviews where id='a0000002-0000-0000-0000-000000000000'), 1, 'szerző látja a saját hidden véleményét');

-- Moderátor látja a hiddent.
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.board_reviews where id='a0000002-0000-0000-0000-000000000000'), 1, 'moderátor látja a hidden véleményt');

-- ===========================================================================
-- Insert-gate: bejelentkezve + megerősített e-mail + saját user_id
-- ===========================================================================
-- Megerősítetlen e-mail → tilos.
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ insert into public.board_reviews (board_id, user_id, rating_overall)
  values ('b0000003-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222', 5) $$, '42501', NULL,
  'reviews: megerősítetlen e-maillel NEM lehet véleményt írni');

-- Megerősített user saját néven → OK.
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.board_reviews (board_id, user_id, rating_overall)
  values ('b0000003-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111', 4) $$,
  'reviews: megerősített user írhat saját véleményt');

-- Megerősített user MÁS nevében → tilos.
select throws_ok($$ insert into public.board_reviews (board_id, user_id, rating_overall)
  values ('b0000004-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555', 4) $$, '42501', NULL,
  'reviews: nem lehet más nevében írni (tulajdon-ellenőrzés)');

-- Anon → tilos.
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select throws_ok($$ insert into public.board_reviews (board_id, user_id, rating_overall)
  values ('b0000005-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111', 4) $$, '42501', NULL,
  'reviews: anon NEM írhat véleményt');

-- ===========================================================================
-- Column-védelem: verified_owner + status user-oldali update-ből nem módosul
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ update public.board_reviews set status='hidden', verified_owner=true, text_pros='jó'
  where id='a0000001-0000-0000-0000-000000000000' $$, 'reviews: user update-je lefut (RLS engedi a saját sort)');
reset role;
select set_config('request.jwt.claims','', true);
select is((select status from public.board_reviews where id='a0000001-0000-0000-0000-000000000000'), 'published',
  'reviews: user NEM állíthatja a status-t (column-védelem)');
select is((select verified_owner from public.board_reviews where id='a0000001-0000-0000-0000-000000000000'), false,
  'reviews: user NEM állíthatja a verified_owner jelvényt (column-védelem)');
select is((select text_pros from public.board_reviews where id='a0000001-0000-0000-0000-000000000000'), 'jó',
  'reviews: a sima mező-módosítás viszont érvényesült');

-- Moderátor VISZONT moderálhat (status + jelvény).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ update public.board_reviews set status='hidden', verified_owner=true where id='a0000001-0000-0000-0000-000000000000' $$,
  'reviews: moderátor update-je lefut');
reset role;
select set_config('request.jwt.claims','', true);
select is((select status from public.board_reviews where id='a0000001-0000-0000-0000-000000000000'), 'hidden',
  'reviews: moderátor elrejtette a véleményt');
select is((select verified_owner from public.board_reviews where id='a0000001-0000-0000-0000-000000000000'), true,
  'reviews: moderátor kiadta a verified_owner jelvényt');

-- ===========================================================================
-- review_flags
-- ===========================================================================
-- Megerősített user flag-elhet (saját néven).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select lives_ok($$ insert into public.review_flags (id, review_id, flagged_by, reason)
  values ('f0000001-0000-0000-0000-000000000000','a0000002-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','spam') $$,
  'review_flags: megerősített user bejelenthet');

-- Megerősítetlen NEM flag-elhet.
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ insert into public.review_flags (review_id, flagged_by, reason)
  values ('a0000001-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','spam') $$, '42501', NULL,
  'review_flags: megerősítetlen e-maillel NEM lehet bejelenteni');

-- A bejelentő látja a sajátját; idegen user nem.
select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.review_flags where id='f0000001-0000-0000-0000-000000000000'), 1, 'review_flags: bejelentő látja a sajátját');
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.review_flags where id='f0000001-0000-0000-0000-000000000000'), 0, 'review_flags: idegen user NEM látja a flaget');

-- Moderátor látja és feloldhatja; sima user nem oldhatja fel.
update public.review_flags set resolved=true where id='f0000001-0000-0000-0000-000000000000';   -- user1 kísérlet → 0 sor
reset role;
select set_config('request.jwt.claims','', true);
select is((select resolved from public.review_flags where id='f0000001-0000-0000-0000-000000000000'), false,
  'review_flags: sima user NEM oldhatja fel a flaget (RLS)');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.review_flags where id='f0000001-0000-0000-0000-000000000000'), 1, 'review_flags: moderátor látja a flaget');
select lives_ok($$ update public.review_flags set resolved=true, resolved_by='33333333-3333-3333-3333-333333333333'
  where id='f0000001-0000-0000-0000-000000000000' $$, 'review_flags: moderátor feloldhatja');

-- ===========================================================================
-- Törlés
-- ===========================================================================
-- Idegen user nem törölheti (RLS → 0 sor).
select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
delete from public.board_reviews where id='a0000001-0000-0000-0000-000000000000';
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.board_reviews where id='a0000001-0000-0000-0000-000000000000'), 1,
  'reviews: idegen user NEM törölheti a véleményt');

-- Szerző törölheti a sajátját.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ delete from public.board_reviews where id='a0000001-0000-0000-0000-000000000000' $$, 'reviews: a szerző törölheti a sajátját');

-- ===========================================================================
-- review_flags törlés (flags_delete_mod) — sima user nem, moderator igen
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
delete from public.review_flags where id='f0000001-0000-0000-0000-000000000000';   -- bejelentő kísérlet → 0 sor
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.review_flags where id='f0000001-0000-0000-0000-000000000000'), 1,
  'review_flags: sima user NEM törölhet flaget (RLS deny, 0 sor)');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$ delete from public.review_flags where id='f0000001-0000-0000-0000-000000000000' $$,
  'review_flags: moderator törölhet flaget');
reset role;
select set_config('request.jwt.claims','', true);

select * from finish();
rollback;
