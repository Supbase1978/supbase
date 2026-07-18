-- ============================================================================
-- CORE — Biztonsági helper-függvények (F1.2, 3.2 + 4. fejezet)
-- Modul: core. Idempotens (create or replace).
--
-- Ezek a SECURITY DEFINER függvények a RLS-policyk közös nyelve:
--   * is_email_confirmed() — 4. fej. 1. pont: írás csak megerősített e-maillel.
--   * current_user_role()  — a szerep FORRÁSA a profiles.role; a definer-jog
--     megkerüli a profiles RLS-t → nincs rekurzív RLS-csapda.
--   * is_moderator()/is_admin() — moderációs policyk kényelmi rövidítései.
--
-- Mind `set search_path = ''` + teljesen minősített hivatkozás (search-path
-- injektálás ellen), és `stable` (soronként cache-elhető a plannernek).
-- ============================================================================

-- Megerősített-e a bejelentkezett fiók e-mailje?
-- Az auth.users az autoritatív forrás (a JWT elavulhat); definer-jog olvassa.
create or replace function public.is_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

comment on function public.is_email_confirmed() is
  '4. fej. 1. pont: írás-gate. true, ha az auth.uid() fiók e-mailje megerősített.';

-- A bejelentkezett felhasználó szerepe a profiles.role-ból, védett defaulttal.
-- plpgsql: a profiles tábla a következő core-migrációban jön létre; a törzs
-- futásidőben oldódik fel, így a függvény sorrend-független.
create or replace function public.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return 'anon';
  end if;
  select p.role into v_role from public.profiles p where p.id = auth.uid();
  return coalesce(v_role, 'user');  -- ismeretlen/hiányzó SOHA nem ad emelt jogot
end;
$$;

comment on function public.current_user_role() is
  'A szerep forrása a profiles.role (definer-jog → nincs rekurzív RLS). anon, ha nincs auth.uid().';

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_role() in ('moderator', 'admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_role() = 'admin';
$$;

-- A helpereket az anon és authenticated szerep is hívhatja (RLS-policykban).
grant execute on function public.is_email_confirmed() to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_moderator() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
