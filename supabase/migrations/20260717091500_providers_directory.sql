-- ============================================================================
-- MODUL: providers — providers + provider_spots + provider_leads (3.1, B2B).
-- Idempotens, additív. RLS (3.2 + 4. fej. 5/6.):
--   * providers: publikus olvasás; "claim" = owner_user_id alapú; a `verified`
--     jelvényt CSAK admin állíthatja (column-védelem insertre és update-re is).
--   * provider_leads: bárki küldhet érdeklődést; a lead-et a küldő + a provider
--     tulajdonosa + admin láthatja.
-- ============================================================================

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles,    -- "claim your listing"
  name text not null, slug jsonb not null,
  type text[] not null,         -- {'rental','tour','lesson','accommodation'}
  description jsonb, contact_email text, contact_phone text, website_url text,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_spots (
  provider_id uuid references public.providers,
  spot_id uuid references public.spots,
  primary key (provider_id, spot_id)
);

create table if not exists public.provider_leads (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers not null,
  user_id uuid references public.profiles, name text, email text not null, message text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.providers enable row level security;
alter table public.provider_spots enable row level security;
alter table public.provider_leads enable row level security;

-- ---------------------------------------------------------------------------
-- Column-védelem: a `verified` jelvényt ÉS a `tier` (fizetős csomag) besorolást
-- user SOHA nem állíthatja (csak admin). Insertnél kényszerített biztonságos default
-- (verified=false, tier='free'), update-nél OLD megőrzése nem-admin esetén.
-- A tier fizetéshez kötött (F3): önemelés premiumra csak admin/számlázás útján.
-- ---------------------------------------------------------------------------
create or replace function public.protect_provider_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.tier := 'free';
    else
      new.verified := old.verified;
      new.tier := old.tier;
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'protect_provider_columns_trg' and not tgisinternal
  ) then
    create trigger protect_provider_columns_trg
      before insert or update on public.providers
      for each row execute function public.protect_provider_columns();
  end if;
end $$;

do $$
begin
  -- providers --------------------------------------------------------------
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='providers' and policyname='providers_public_read') then
    create policy providers_public_read on public.providers for select using (true);
  end if;
  -- Claim: bejelentkezve, saját tulajdonként (verified a triggerben false-ra kényszerítve).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='providers' and policyname='providers_insert_own_claim') then
    create policy providers_insert_own_claim on public.providers
      for insert to authenticated with check (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='providers' and policyname='providers_update_owner') then
    create policy providers_update_owner on public.providers
      for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='providers' and policyname='providers_update_admin') then
    create policy providers_update_admin on public.providers
      for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='providers' and policyname='providers_delete_admin') then
    create policy providers_delete_admin on public.providers
      for delete to authenticated using (public.is_admin());
  end if;

  -- provider_spots ---------------------------------------------------------
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='provider_spots' and policyname='provider_spots_public_read') then
    create policy provider_spots_public_read on public.provider_spots for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='provider_spots' and policyname='provider_spots_owner_write') then
    create policy provider_spots_owner_write on public.provider_spots
      for all to authenticated
      using (exists (select 1 from public.providers p
                     where p.id = provider_spots.provider_id
                       and (p.owner_user_id = auth.uid() or public.is_admin())))
      with check (exists (select 1 from public.providers p
                          where p.id = provider_spots.provider_id
                            and (p.owner_user_id = auth.uid() or public.is_admin())));
  end if;

  -- provider_leads ---------------------------------------------------------
  -- Küldő + provider-tulajdonos + admin láthatja.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='provider_leads' and policyname='provider_leads_select_scoped') then
    create policy provider_leads_select_scoped on public.provider_leads
      for select to authenticated using (
        user_id = auth.uid()
        or public.is_admin()
        or exists (select 1 from public.providers p
                   where p.id = provider_leads.provider_id and p.owner_user_id = auth.uid())
      );
  end if;
  -- Érdeklődés bárkitől (anon is): saját user_id vagy null.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='provider_leads' and policyname='provider_leads_insert_any') then
    create policy provider_leads_insert_any on public.provider_leads
      for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
  end if;
  -- Státusz-kezelés: provider-tulajdonos vagy admin.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='provider_leads' and policyname='provider_leads_update_owner_or_admin') then
    create policy provider_leads_update_owner_or_admin on public.provider_leads
      for update to authenticated using (
        public.is_admin()
        or exists (select 1 from public.providers p
                   where p.id = provider_leads.provider_id and p.owner_user_id = auth.uid())
      ) with check (
        public.is_admin()
        or exists (select 1 from public.providers p
                   where p.id = provider_leads.provider_id and p.owner_user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='provider_leads' and policyname='provider_leads_delete_admin') then
    create policy provider_leads_delete_admin on public.provider_leads
      for delete to authenticated using (public.is_admin());
  end if;
end $$;
