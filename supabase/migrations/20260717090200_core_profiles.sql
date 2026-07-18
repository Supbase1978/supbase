-- ============================================================================
-- CORE — profiles (közös tábla, 3.1). CSAK core-migráció nyúlhat hozzá (1.3).
-- Idempotens, additív. RLS + column-védelem (role önemelés tiltva).
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  rider_weight_kg int,
  experience text check (experience in ('kezdo', 'halado', 'versenyzo')),
  locale text not null default 'hu',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Auto-profil: minden új auth.users → profiles sor (definer, RLS-t megkerül).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'felhasznalo'), '@', 1)
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'hu')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created' and not tgisinternal
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Column-védelem: a `role`-t csak admin írhatja (önjogosultság-emelés tiltva).
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.role := old.role;  -- nem-admin update SOHA nem változtathat szerepet
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_profile_columns_trg' and not tgisinternal
  ) then
    create trigger protect_profile_columns_trg
      before update on public.profiles
      for each row execute function public.protect_profile_columns();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS-policyk
--   Döntés: publikus SELECT — a Népítélet/SSR publikus oldalak a szerző
--   display_name-jét kötés nélkül renderelik. (rider_weight/experience nem
--   érzékeny; ha később az lesz, nézet mögé kerül. Lásd: nyitott kérdések.)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_public_read') then
    create policy profiles_public_read on public.profiles
      for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_insert') then
    create policy profiles_self_insert on public.profiles
      for insert to authenticated with check (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_update') then
    create policy profiles_self_update on public.profiles
      for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_admin_update') then
    create policy profiles_admin_update on public.profiles
      for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_admin_delete') then
    create policy profiles_admin_delete on public.profiles
      for delete to authenticated using (public.is_admin());
  end if;
end $$;
