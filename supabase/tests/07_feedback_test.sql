-- ============================================================================
-- RLS-teszt — fejlesztői visszajelzés-csatorna (F2.2). pgTAP.
-- Fedi: saját nevében írás, idegen név TILTVA, e-mail-gate, admin-only olvasás
-- és állapotkezelés, oszlop-védő trigger, hossz-kényszerek.
-- Tranzakció + rollback (nem szennyez).
-- ============================================================================
begin;
create extension if not exists pgtap;
select * from no_plan();

-- --- Fixtúrák (superuser) ---------------------------------------------------
alter table public.profiles disable trigger protect_profile_columns_trg;
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('f1111111-1111-1111-1111-111111111111','authenticated','authenticated','fb-user@test.dev', now()),
  ('f2222222-2222-2222-2222-222222222222','authenticated','authenticated','fb-other@test.dev', now()),
  ('f3333333-3333-3333-3333-333333333333','authenticated','authenticated','fb-new@test.dev', null),
  ('f9999999-9999-9999-9999-999999999999','authenticated','authenticated','fb-admin@test.dev', now());
update public.profiles set role = 'admin' where id = 'f9999999-9999-9999-9999-999999999999';
alter table public.profiles enable trigger protect_profile_columns_trg;

-- ===========================================================================
-- BEKÜLDÉS — saját néven, megerősített e-maillel
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.feedback (user_id, kind, message, page_path)
     values ('f1111111-1111-1111-1111-111111111111','shop',
             'A Suptime-ból hiányzik a helyi SUP-bolt, érdemes lenne felvenni.','/deszkak') $$,
  'feedback: bejelentkezett user beküldhet a saját nevében');

select is((select count(*)::int from public.feedback), 1,
  'feedback: pontosan egy sor jött létre');

-- A beküldő NEM állíthat állapotot: a trigger visszaírja az alapértelmezettet.
select lives_ok(
  $$ insert into public.feedback (user_id, kind, message, status, admin_note)
     values ('f1111111-1111-1111-1111-111111111111','bug',
             'A spot-adatlapon elcsúszik a vízmérce mobilon.','done','saját jegyzet') $$,
  'feedback: a status/admin_note megadása nem hiúsítja meg a beküldést');
select is(
  (select count(*)::int from public.feedback where status <> 'new' or admin_note is not null), 0,
  'feedback: a beküldő állapota MINDIG new, admin-jegyzet nélkül (oszlop-védő trigger)');

-- IDEGEN néven beküldeni tilos (RLS with check).
select throws_ok(
  $$ insert into public.feedback (user_id, kind, message)
     values ('f2222222-2222-2222-2222-222222222222','idea','Idegen nevében beküldött visszajelzés.') $$,
  '42501', null, 'feedback: idegen user_id-vel nem lehet beküldeni');

-- Túl rövid üzenet: kényszer fogja.
select throws_ok(
  $$ insert into public.feedback (user_id, kind, message)
     values ('f1111111-1111-1111-1111-111111111111','bug','hiba') $$,
  '23514', null, 'feedback: a túl rövid üzenetet a kényszer elutasítja');

-- Ismeretlen kind: kényszer fogja.
select throws_ok(
  $$ insert into public.feedback (user_id, kind, message)
     values ('f1111111-1111-1111-1111-111111111111','spam','Elég hosszú üzenet a kényszer teszteléséhez.') $$,
  '23514', null, 'feedback: ismeretlen kind-ot a kényszer elutasítja');

-- A beküldő SAJÁT sorát sem olvashatja vissza (a csatorna a fejlesztőé).
select is((select count(*)::int from public.feedback), 0,
  'feedback: a beküldő nem olvassa vissza a saját visszajelzését sem');

-- GYAKORISÁG-KORLÁT: óránként 5. Kettő már megvan, jöjjön még három, a hatodik bukjon.
select lives_ok(
  $$ insert into public.feedback (user_id, kind, message)
     select 'f1111111-1111-1111-1111-111111111111','idea',
            'Sorszámozott visszajelzés a korlát teszteléséhez: ' || g
       from generate_series(3,5) g $$,
  'feedback: az óránkénti korlátig a beküldés megy');
select throws_ok(
  $$ insert into public.feedback (user_id, kind, message)
     values ('f1111111-1111-1111-1111-111111111111','idea',
             'Ez a hatodik visszajelzés egy órán belül, el kell hasalnia.') $$,
  'P0001', null, 'feedback: a hatodik beküldés egy órán belül elutasítva (rate limit)');

-- ===========================================================================
-- E-MAIL-GATE — megerősítetlen e-mailű user nem küldhet
-- ===========================================================================
select set_config('request.jwt.claims','{"sub":"f3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.feedback (user_id, kind, message)
     values ('f3333333-3333-3333-3333-333333333333','bug','Megerősítetlen e-mailű user próbálkozása.') $$,
  '42501', null, 'feedback: megerősítetlen e-maillel nem lehet beküldeni');

-- ===========================================================================
-- ANONIM — se írni, se olvasni
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select throws_ok(
  $$ insert into public.feedback (user_id, kind, message)
     values (null,'bug','Anonim beküldés próbája, elég hosszú szöveggel.') $$,
  '42501', null, 'feedback: anonim nem küldhet be');
select is((select count(*)::int from public.feedback), 0,
  'feedback: anonim nem lát semmit');

-- ===========================================================================
-- ADMIN — olvas és állapotot kezel
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f9999999-9999-9999-9999-999999999999","role":"authenticated"}', true);

select is((select count(*)::int from public.feedback), 5,
  'feedback: az admin látja az összes beküldött visszajelzést');

select lives_ok(
  $$ update public.feedback set status = 'done', admin_note = 'Felvéve a katalógusba.',
       handled_by = 'f9999999-9999-9999-9999-999999999999', handled_at = now()
     where kind = 'shop' $$,
  'feedback: az admin állapotot és jegyzetet ír');
select is((select status from public.feedback where kind = 'shop'), 'done',
  'feedback: az admin állapot-változtatása érvényre jut');

select * from finish();
rollback;
