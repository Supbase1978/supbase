-- ============================================================================
-- RLS-teszt — providers modul (providers / provider_spots / provider_leads). pgTAP.
-- Kiemelt: "claim your listing" (owner_user_id), a `verified` jelvény column-védelme
-- (user SOHA nem állíthatja, admin igen; insertkor false-ra kényszerül), lead-láthatóság
-- (küldő + provider-tulajdonos + admin). Tranzakció + rollback (nem szennyez).
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111','authenticated','authenticated','owner@test.dev',  now()),  -- provider-tulajdonos
  ('55555555-5555-5555-5555-555555555555','authenticated','authenticated','sender@test.dev', now()),  -- lead-küldő / idegen provider-hez
  ('44444444-4444-4444-4444-444444444444','authenticated','authenticated','admin@test.dev',  now()),
  ('77777777-7777-7777-7777-777777777777','authenticated','authenticated','outsider@test.dev', now()); -- teljesen kívülálló
update public.profiles set role='admin' where id='44444444-4444-4444-4444-444444444444';
alter table public.profiles enable trigger protect_profile_columns_trg;

-- ===========================================================================
-- providers — publikus olvasás (seed: 5 szolgáltató)
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select cmp_ok((select count(*)::int from public.providers),      '>=', 5, 'providers: anon publikus olvasás (seed)');
select cmp_ok((select count(*)::int from public.provider_spots), '>=', 8, 'provider_spots: anon publikus olvasás (seed)');

-- anon NEM claim-elhet (insert `to authenticated`).
select throws_ok($$ insert into public.providers (owner_user_id, name, slug, type)
  values (null,'Anon Provider','{"hu":"anon","en":"anon"}','{rental}') $$, '42501', NULL,
  'providers: anon NEM hozhat létre szolgáltatót');

-- ===========================================================================
-- providers_insert_own_claim + verified column-védelem
-- ===========================================================================
-- Negatív: user1 NEM claim-elhet MÁS nevében (with check owner_user_id = auth.uid()).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ insert into public.providers (owner_user_id, name, slug, type)
  values ('55555555-5555-5555-5555-555555555555','Lopott','{"hu":"lopott","en":"stolen"}','{rental}') $$, '42501', NULL,
  'providers: user NEM claim-elhet más nevében (with check)');

-- Pozitív: user1 claim-eli a sajátját ÉS verified=true + tier='premium'-ot próbál →
-- a trigger biztonságos defaultra kényszeríti (verified=false, tier='free').
select lives_ok($$ insert into public.providers (id, owner_user_id, name, slug, type, verified, tier)
  values ('a1000001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111',
          'Saját Kölcsönző','{"hu":"sajat","en":"own"}','{rental,lesson}', true, 'premium') $$,
  'providers: user claim-elheti a sajátját');
reset role;
select set_config('request.jwt.claims','', true);
select is((select verified from public.providers where id='a1000001-0000-0000-0000-000000000000'), false,
  'providers: a `verified` jelvény insertkor false-ra kényszerül (user nem adhatja ki magának)');
select is((select tier from public.providers where id='a1000001-0000-0000-0000-000000000000'), 'free',
  'providers: a `tier` insertkor free-re kényszerül (user nem emelhet premiumra)');

-- ===========================================================================
-- providers_update_owner / update_admin + verified column-védelem
-- ===========================================================================
-- Owner szerkesztheti a sajátját, DE a verified=true nem érvényesül (trigger).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ update public.providers set name='Saját Kölcsönző Plusz', verified=true, tier='premium'
  where id='a1000001-0000-0000-0000-000000000000' $$, 'providers: owner szerkesztheti a sajátját');
reset role;
select set_config('request.jwt.claims','', true);
select is((select name from public.providers where id='a1000001-0000-0000-0000-000000000000'), 'Saját Kölcsönző Plusz',
  'providers: owner név-módosítása érvényesült');
select is((select verified from public.providers where id='a1000001-0000-0000-0000-000000000000'), false,
  'providers: owner NEM állíthatja a verified jelvényt (column-védelem)');
select is((select tier from public.providers where id='a1000001-0000-0000-0000-000000000000'), 'free',
  'providers: owner NEM emelheti a tier-t premiumra (column-védelem)');

-- Idegen (user2) update-je nem hat (using owner_user_id = auth.uid() → 0 sor).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
update public.providers set name='Eltérített' where id='a1000001-0000-0000-0000-000000000000';
reset role;
select set_config('request.jwt.claims','', true);
select isnt((select name from public.providers where id='a1000001-0000-0000-0000-000000000000'), 'Eltérített',
  'providers: idegen user update-je nem hat (RLS)');

-- Admin VISZONT kiadhatja a verified jelvényt.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$ update public.providers set verified=true, tier='premium'
  where id='a1000001-0000-0000-0000-000000000000' $$, 'providers: admin update-je lefut');
reset role;
select set_config('request.jwt.claims','', true);
select is((select verified from public.providers where id='a1000001-0000-0000-0000-000000000000'), true,
  'providers: admin kiadhatja a verified jelvényt');
select is((select tier from public.providers where id='a1000001-0000-0000-0000-000000000000'), 'premium',
  'providers: admin átállíthatja a tier-t premiumra');

-- ===========================================================================
-- provider_spots_owner_write — owner/admin írhat; idegen nem
-- ===========================================================================
-- Owner hozzárendelhet spotot a saját szolgáltatójához.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ insert into public.provider_spots (provider_id, spot_id)
  values ('a1000001-0000-0000-0000-000000000000','d0000002-0000-0000-0000-000000000000') $$,
  'provider_spots: owner hozzárendelhet spotot');

-- Idegen NEM rendelhet hozzá a más szolgáltatójához (with check exists owner → 42501).
select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok($$ insert into public.provider_spots (provider_id, spot_id)
  values ('a1000001-0000-0000-0000-000000000000','d0000003-0000-0000-0000-000000000000') $$, '42501', NULL,
  'provider_spots: idegen NEM rendelhet hozzá spotot más szolgáltatójához');

-- Admin hozzárendelhet.
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$ insert into public.provider_spots (provider_id, spot_id)
  values ('a1000001-0000-0000-0000-000000000000','d0000004-0000-0000-0000-000000000000') $$,
  'provider_spots: admin hozzárendelhet spotot');
reset role;
select set_config('request.jwt.claims','', true);

-- ===========================================================================
-- provider_leads — insert bárkitől; select küldő/owner/admin; update owner/admin; delete admin
-- ===========================================================================
-- Anon érdeklődést küldhet (user_id null).
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select lives_ok($$ insert into public.provider_leads (id, provider_id, user_id, email, message)
  values ('a2000001-0000-0000-0000-000000000000','a1000001-0000-0000-0000-000000000000', null,'anon@x.dev','Szia') $$,
  'provider_leads: anon küldhet érdeklődést (user_id null)');

-- user2 saját néven küldhet.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select lives_ok($$ insert into public.provider_leads (id, provider_id, user_id, email, message)
  values ('a2000002-0000-0000-0000-000000000000','a1000001-0000-0000-0000-000000000000',
          '55555555-5555-5555-5555-555555555555','sender@x.dev','Érdeklődés') $$,
  'provider_leads: user saját néven küldhet érdeklődést');

-- user2 NEM küldhet MÁS user_id-jével (with check → 42501).
select throws_ok($$ insert into public.provider_leads (provider_id, user_id, email)
  values ('a1000001-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','x@x.dev') $$, '42501', NULL,
  'provider_leads: user NEM küldhet más user_id-jével');

-- Láthatóság: a küldő (user2) látja a saját leadjét, de a másikat (anon) NEM.
select is((select count(*)::int from public.provider_leads where id='a2000002-0000-0000-0000-000000000000'), 1,
  'provider_leads: a küldő látja a saját leadjét');
select is((select count(*)::int from public.provider_leads where id='a2000001-0000-0000-0000-000000000000'), 0,
  'provider_leads: a küldő NEM látja a hozzá nem tartozó (anon) leadet');

-- A provider-tulajdonos (user1) látja a szolgáltatójára érkező ÖSSZES leadet.
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.provider_leads
           where id in ('a2000001-0000-0000-0000-000000000000','a2000002-0000-0000-0000-000000000000')), 2,
  'provider_leads: a provider-tulajdonos látja a szolgáltatójára érkező leadeket');

-- Kívülálló (nem küldő, nem owner, nem admin) semmit sem lát.
select set_config('request.jwt.claims','{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select is((select count(*)::int from public.provider_leads
           where id in ('a2000001-0000-0000-0000-000000000000','a2000002-0000-0000-0000-000000000000')), 0,
  'provider_leads: kívülálló user egy leadet sem lát');

-- Admin mindet látja.
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from public.provider_leads
           where id in ('a2000001-0000-0000-0000-000000000000','a2000002-0000-0000-0000-000000000000')), 2,
  'provider_leads: admin minden leadet lát');

-- Státusz-kezelés: kívülálló nem, owner igen.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
update public.provider_leads set status='contacted' where id='a2000001-0000-0000-0000-000000000000';
reset role;
select set_config('request.jwt.claims','', true);
select is((select status from public.provider_leads where id='a2000001-0000-0000-0000-000000000000'), 'new',
  'provider_leads: kívülálló NEM kezelheti a lead státuszát (RLS deny, 0 sor)');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$ update public.provider_leads set status='contacted' where id='a2000001-0000-0000-0000-000000000000' $$,
  'provider_leads: a provider-tulajdonos kezelheti a lead státuszát');

-- Törlés: owner NEM törölhet lead-et (csak admin); admin igen.
delete from public.provider_leads where id='a2000001-0000-0000-0000-000000000000';   -- owner kísérlet → 0 sor
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.provider_leads where id='a2000001-0000-0000-0000-000000000000'), 1,
  'provider_leads: owner NEM törölhet leadet (csak admin, 0 sor)');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select lives_ok($$ delete from public.provider_leads where id='a2000001-0000-0000-0000-000000000000' $$,
  'provider_leads: admin törölhet leadet');

-- ===========================================================================
-- providers_delete_admin — owner/idegen nem törölhet szolgáltatót, admin igen
-- ===========================================================================
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
delete from public.providers where id='a1000001-0000-0000-0000-000000000000';   -- owner kísérlet → 0 sor
reset role;
select set_config('request.jwt.claims','', true);
select is((select count(*)::int from public.providers where id='a1000001-0000-0000-0000-000000000000'), 1,
  'providers: owner (nem admin) NEM törölhet szolgáltatót (nincs owner-delete policy)');

-- Admin törléséhez előbb a gyerek-sorokat (provider_spots, leads) rendezni kell (FK).
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
delete from public.provider_leads where provider_id='a1000001-0000-0000-0000-000000000000';
delete from public.provider_spots where provider_id='a1000001-0000-0000-0000-000000000000';
select lives_ok($$ delete from public.providers where id='a1000001-0000-0000-0000-000000000000' $$,
  'providers: admin törölhet szolgáltatót');

select * from finish();
rollback;
