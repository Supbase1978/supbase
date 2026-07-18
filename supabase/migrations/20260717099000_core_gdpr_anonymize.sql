-- ============================================================================
-- CORE — GDPR fiók-törlés / anonimizálás (4. fej. 7. pont).
-- Idempotens, additív. Legutolsó core-migráció: minden modul-táblát érint,
-- ezért az összes tábla létrejötte UTÁN fut (timestamp 0990…).
--
-- A `delete-account` Edge Function (F1.9) service_role joggal hívja:
--   1) select public.anonymize_user(<uid>)   -- vélemények megmaradnak, szerző = sentinel
--   2) auth admin deleteUser(<uid>)           -- az auth-rekord + profil (cascade) törlődik
-- A Népítélet-aggregátumok így NEM sérülnek; a törölt user "Törölt felhasználó".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sentinel ("Törölt felhasználó"): a megmaradó tartalom ide-mutató szerzője.
-- profiles.id → auth.users FK miatt előbb az auth-rekord kell (a handle_new_user
-- trigger létrehozza a profilt; a display_name-t utána biztosra állítjuk).
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'torolt-felhasznalo@sup.invalid',
  now(), now(), now(), '{"display_name":"Törölt felhasználó"}'::jsonb
)
on conflict (id) do nothing;

insert into public.profiles (id, display_name, role, locale)
values ('00000000-0000-0000-0000-000000000000', 'Törölt felhasználó', 'user', 'hu')
on conflict (id) do update set display_name = excluded.display_name;

-- ---------------------------------------------------------------------------
-- Anonimizáló függvény. A tartalmat NEM törli, hanem a sentinelre írja át.
-- board_reviews unique(board_id,user_id): két törölt user ugyanarra a deszkára
-- ütközne → a duplikátumot előbb töröljük, a többit átírjuk.
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sentinel constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if target_user is null or target_user = sentinel then
    return;
  end if;

  -- Népítélet: szerző → sentinel (ütköző duplikátum eldobva).
  delete from public.board_reviews br
   where br.user_id = target_user
     and exists (select 1 from public.board_reviews s
                 where s.board_id = br.board_id and s.user_id = sentinel);
  update public.board_reviews set user_id = sentinel where user_id = target_user;

  update public.spot_reports set user_id = sentinel where user_id = target_user;
  update public.review_flags set flagged_by = sentinel where flagged_by = target_user;
  update public.review_flags set resolved_by = null where resolved_by = target_user;

  -- Mérés/rendelés: megőrzés anonimizálva (aggregátumok védelme).
  update public.advisor_sessions set user_id = null where user_id = target_user;
  update public.orders set user_id = sentinel where user_id = target_user;
  update public.provider_leads
     set user_id = null, name = null, email = 'torolt@sup.invalid'
   where user_id = target_user;

  -- Eszköz-tokenek törlése; szolgáltatói tulajdon leválasztása.
  delete from public.push_subscriptions where user_id = target_user;
  update public.providers set owner_user_id = null where owner_user_id = target_user;
end;
$$;

comment on function public.anonymize_user(uuid) is
  'GDPR: a user tartalmát a sentinelre írja át (nem törli). Csak service_role hívhatja.';

-- Csak a service_role (Edge Function) futtathatja — user nem anonimizálhat mást.
revoke execute on function public.anonymize_user(uuid) from public;
revoke execute on function public.anonymize_user(uuid) from anon, authenticated;
grant execute on function public.anonymize_user(uuid) to service_role;
