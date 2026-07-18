-- ============================================================================
-- RLS-teszt — core helperek + profiles (F1.2). pgTAP.
-- Szerepek: anon / user (confirmed) / user (unconfirmed) / moderator / admin.
-- Minden policyhoz pozitív ÉS negatív eset. Tranzakció + rollback (nem szennyez).
-- ============================================================================
begin;
-- pgTAP a rollback-elt tranzakcióban jön létre (public sémába) → efemer, prod-migrációt
-- nem szennyez, az unqualified pgTAP-hívások feloldódnak.
create extension if not exists pgtap;
select * from no_plan();

-- --- Fixtúrák (superuser) ---------------------------------------------------
-- A profiles.role-t védő trigger update-en visszaállítja a szerepet, ezért a
-- teszt-szerepek beállításához ideiglenesen kikapcsoljuk (tranzakció-lokálisan).
alter table public.profiles disable trigger protect_profile_columns_trg;

insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111','authenticated','authenticated','user1@test.dev',  now()),
  ('22222222-2222-2222-2222-222222222222','authenticated','authenticated','unconf@test.dev',  null),
  ('33333333-3333-3333-3333-333333333333','authenticated','authenticated','mod@test.dev',     now()),
  ('44444444-4444-4444-4444-444444444444','authenticated','authenticated','admin@test.dev',   now()),
  ('55555555-5555-5555-5555-555555555555','authenticated','authenticated','user2@test.dev',   now());

update public.profiles set role='moderator' where id='33333333-3333-3333-3333-333333333333';
update public.profiles set role='admin'     where id='44444444-4444-4444-4444-444444444444';
alter table public.profiles enable trigger protect_profile_columns_trg;

-- ===========================================================================
-- Helper-függvények
-- ===========================================================================
set local role authenticated;

select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(public.is_email_confirmed(), true,  'is_email_confirmed: megerősített user → true');
select is(public.current_user_role(), 'user', 'current_user_role: sima user → user');

select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(public.is_email_confirmed(), false, 'is_email_confirmed: megerősítetlen user → false');

select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(public.current_user_role(), 'moderator', 'current_user_role: moderator');
select is(public.is_moderator(), true,  'is_moderator: moderator → true');
select is(public.is_admin(), false,     'is_admin: moderator → false');

select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is(public.is_admin(), true, 'is_admin: admin → true');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(public.current_user_role(), 'anon', 'current_user_role: anon (nincs auth.uid)');

-- ===========================================================================
-- profiles — RLS
-- ===========================================================================
-- Publikus olvasás (anon).
select cmp_ok((select count(*)::int from public.profiles), '>=', 5, 'profiles: anon publikus olvasás');

-- Saját profil szerkesztése (user1).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ update public.profiles set display_name='Én Új Nevem' where id='11111111-1111-1111-1111-111111111111' $$,
  'profiles: user szerkesztheti a saját display_name-jét');

-- Önjogosultság-emelés TILOS (trigger visszaállít).
update public.profiles set role='admin' where id='11111111-1111-1111-1111-111111111111';
reset role;
select set_config('request.jwt.claims','', true);
select is((select role from public.profiles where id='11111111-1111-1111-1111-111111111111'), 'user',
  'profiles: user NEM emelheti a saját szerepét (column-védelem)');
select is((select display_name from public.profiles where id='11111111-1111-1111-1111-111111111111'), 'Én Új Nevem',
  'profiles: a display_name-módosítás viszont megmaradt');

-- Idegen profil szerkesztése NEM megy (RLS → 0 sor).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update public.profiles set display_name='Betörés' where id='55555555-5555-5555-5555-555555555555';
reset role;
select set_config('request.jwt.claims','', true);
select isnt((select display_name from public.profiles where id='55555555-5555-5555-5555-555555555555'), 'Betörés',
  'profiles: user NEM szerkesztheti más profilját');

-- Admin átállíthatja más szerepét.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$ update public.profiles set role='moderator' where id='55555555-5555-5555-5555-555555555555' $$,
  'profiles: admin update lefut');
reset role;
select set_config('request.jwt.claims','', true);
select is((select role from public.profiles where id='55555555-5555-5555-5555-555555555555'), 'moderator',
  'profiles: admin átállította a user szerepét');

-- User nem törölheti a profilját (nincs delete-policy → 0 sor, marad).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
delete from public.profiles where id='11111111-1111-1111-1111-111111111111';
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.profiles where id='11111111-1111-1111-1111-111111111111'), 1,
  'profiles: user NEM törölheti a profilját (nincs policy)');

-- ===========================================================================
-- profiles_self_insert — pozitív + negatív (with check auth.uid() = id)
-- A self_insert tiszta teszteléséhez profil NÉLKÜLI auth-user kell. Az auth.users
-- trigger-toggle NEM megy (a `postgres` nem tulajdonosa az auth.users-nek → "must be
-- owner of table users"), ezért hagyjuk lefutni az auto-profilt, majd a keletkező
-- profiles sort postgres-ként töröljük (a postgres a public.profiles tulajdonosa,
-- RLS force nélkül átmegy rajta).
-- ===========================================================================
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('66666666-6666-6666-6666-666666666666','authenticated','authenticated','user6@test.dev', now());
delete from public.profiles where id='66666666-6666-6666-6666-666666666666';

-- Negatív: user1 NEM hozhat létre profilt más id-vel (with check bukik → 42501).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ insert into public.profiles (id, display_name) values ('66666666-6666-6666-6666-666666666666','Idegen') $$,
  '42501', NULL, 'profiles: user NEM hozhat létre profilt más id-vel (self_insert with check)');

-- Pozitív: user6 létrehozhatja a SAJÁT profilját.
select set_config('request.jwt.claims','{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select lives_ok($$ insert into public.profiles (id, display_name) values ('66666666-6666-6666-6666-666666666666','Én Magam') $$,
  'profiles: user létrehozhatja a SAJÁT profilját (self_insert)');
reset role;
select set_config('request.jwt.claims','', true);

select * from finish();
rollback;
