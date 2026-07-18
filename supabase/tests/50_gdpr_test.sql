-- ============================================================================
-- Függvény-teszt — GDPR anonimizálás: public.anonymize_user(uuid). pgTAP.
-- A függvény NEM töröl tartalmat, hanem a sentinelre ('Törölt felhasználó') írja át,
-- illetve null-ozza / eszköz-tokent töröl. A board_reviews unique(board_id,user_id)
-- ütközését (két törölt user ugyanarra a deszkára) a duplikátum eldobásával kezeli.
-- A hívás superuserként fut (a fv. security definer + csak service_role; superuser
-- bypassol). Tranzakció + rollback (nem szennyez).
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

-- --- Fixtúrák (superuser, RLS-bypass) ---------------------------------------
-- Sentinel a 099000 core-migrációból már létezik: 00000000-0000-0000-0000-000000000000.
select set_config('request.jwt.claims','', true);

-- Törlendő cél-felhasználó (az auto-profil trigger létrehozza a profilját).
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('77777777-7777-7777-7777-777777777777','authenticated','authenticated','target@test.dev', now());

-- board_reviews:
--   aa01 = a SENTINEL véleménye a b0000001 deszkáról (a dup-ütközéshez),
--   aa02 = a CÉL véleménye UGYANARRÓL a b0000001 deszkáról → anonimizáláskor eldobandó,
--   aa03 = a CÉL véleménye a b0000002 deszkáról → sentinelre átírandó.
insert into public.board_reviews (id, board_id, user_id, rating_overall) values
  ('aa000001-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000', 5),
  ('aa000002-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777', 3),
  ('aa000003-0000-0000-0000-000000000000','b0000002-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777', 4);

-- review_flags: ff01 a cél BEJELENTÉSE; ff02 a cél FELOLDÁSA (resolved_by).
insert into public.review_flags (id, review_id, flagged_by, reason, resolved, resolved_by) values
  ('ff000001-0000-0000-0000-000000000000','aa000003-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777','spam', false, null),
  ('ff000002-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','other', true, '77777777-7777-7777-7777-777777777777');

insert into public.spot_reports (id, spot_id, user_id, conditions) values
  ('ab000001-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777','nyugodt');

insert into public.advisor_sessions (id, user_id, inputs, results) values
  ('ac000001-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777','{}'::jsonb,'[]'::jsonb);

insert into public.orders (id, user_id, kind) values
  ('ad000001-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777','subscription');

insert into public.provider_leads (id, provider_id, user_id, name, email) values
  ('ae000001-0000-0000-0000-000000000000','e0000001-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777','Teszt Elek','elek@x.dev');

insert into public.push_subscriptions (id, user_id, platform, token) values
  ('af000001-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777','webpush','{}'::jsonb);

insert into public.providers (id, owner_user_id, name, slug, type) values
  ('a3000001-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777','Cél Szolgáltató','{"hu":"cel","en":"target"}','{rental}');

-- ===========================================================================
-- Guard: null / sentinel bemenet nem csinál semmit (nem dob, nem módosít)
-- ===========================================================================
select lives_ok($$ select public.anonymize_user(null) $$, 'anonymize_user(null): no-op, nem dob');
select lives_ok($$ select public.anonymize_user('00000000-0000-0000-0000-000000000000') $$,
  'anonymize_user(sentinel): no-op, nem dob');
select is((select count(*)::int from public.board_reviews where user_id='77777777-7777-7777-7777-777777777777'), 2,
  'guard után a cél véleményei még érintetlenek (2 db)');

-- ===========================================================================
-- Éles anonimizálás — a valóságban a delete-account Edge Function service_role-lal
-- hívja. A protect_order_columns trigger a service_role-t privilegizált íróként kezeli,
-- így az orders.user_id → sentinel átírás is érvényesül.
-- ===========================================================================
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}', true);
select lives_ok($$ select public.anonymize_user('77777777-7777-7777-7777-777777777777') $$,
  'anonymize_user(cél): lefut');
reset role;
select set_config('request.jwt.claims','', true);

-- board_reviews: az ütköző duplikátum (aa02) eldobva, a többi sentinelre átírva.
select is((select count(*)::int from public.board_reviews where id='aa000002-0000-0000-0000-000000000000'), 0,
  'GDPR: az ütköző (dup) cél-vélemény eldobva (aa02)');
select is((select user_id from public.board_reviews where id='aa000003-0000-0000-0000-000000000000'),
  '00000000-0000-0000-0000-000000000000'::uuid, 'GDPR: a nem-ütköző cél-vélemény szerzője a sentinel (aa03)');
select is((select count(*)::int from public.board_reviews where user_id='77777777-7777-7777-7777-777777777777'), 0,
  'GDPR: a célhoz NEM tartozik több vélemény');
select is((select count(*)::int from public.board_reviews where id='aa000001-0000-0000-0000-000000000000'), 1,
  'GDPR: a sentinel eredeti véleménye megmarad (aggregátum-védelem)');

-- spot_reports → sentinel.
select is((select user_id from public.spot_reports where id='ab000001-0000-0000-0000-000000000000'),
  '00000000-0000-0000-0000-000000000000'::uuid, 'GDPR: spot_report szerzője a sentinel');

-- review_flags: flagged_by → sentinel, resolved_by → null.
select is((select flagged_by from public.review_flags where id='ff000001-0000-0000-0000-000000000000'),
  '00000000-0000-0000-0000-000000000000'::uuid, 'GDPR: review_flag bejelentője a sentinel');
select is((select resolved_by from public.review_flags where id='ff000002-0000-0000-0000-000000000000'),
  null::uuid, 'GDPR: a cél feloldói (resolved_by) hivatkozása null');

-- advisor_sessions → null (anonim mérés megőrizve).
select is((select user_id from public.advisor_sessions where id='ac000001-0000-0000-0000-000000000000'),
  null::uuid, 'GDPR: advisor_session user_id null-ozva (mérés megőrizve)');

-- orders → sentinel (pénzügyi rekord megőrizve).
select is((select user_id from public.orders where id='ad000001-0000-0000-0000-000000000000'),
  '00000000-0000-0000-0000-000000000000'::uuid, 'GDPR: order tulajdonosa a sentinel');

-- provider_leads: user_id null, name null, email maszkolva.
select is((select user_id from public.provider_leads where id='ae000001-0000-0000-0000-000000000000'),
  null::uuid, 'GDPR: provider_lead user_id null-ozva');
select is((select name from public.provider_leads where id='ae000001-0000-0000-0000-000000000000'),
  null::text, 'GDPR: provider_lead name null-ozva');
select is((select email from public.provider_leads where id='ae000001-0000-0000-0000-000000000000'),
  'torolt@sup.invalid', 'GDPR: provider_lead email maszkolva');

-- push_subscriptions törölve (eszköz-token).
select is((select count(*)::int from public.push_subscriptions where id='af000001-0000-0000-0000-000000000000'), 0,
  'GDPR: push_subscription törölve');

-- providers: owner leválasztva (a listázás megmarad).
select is((select owner_user_id from public.providers where id='a3000001-0000-0000-0000-000000000000'),
  null::uuid, 'GDPR: provider owner_user_id leválasztva (listázás megmarad)');

select * from finish();
rollback;
