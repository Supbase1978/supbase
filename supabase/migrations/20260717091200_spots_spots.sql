-- ============================================================================
-- MODUL: spots — spots (PostGIS) + spot_reports (3.1).
-- Idempotens, additív. RLS (3.2): publikus olvasás; spots kurált (moderator/admin);
-- spot_report insert csak megerősített e-maillel + saját néven.
-- ============================================================================

create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug jsonb not null,
  region text, country text not null default 'HU',
  water_type text not null check (water_type in ('to', 'folyo', 'holtag', 'csatorna')),
  difficulty text check (difficulty in ('konnyu', 'kozepes', 'halado')),
  geom geometry(Point, 4326) not null,
  shore_bearing_deg int,        -- a part tájolása → offshore-szél számításhoz
  storm_warning_region text,    -- viharjelzési körzet (Balaton/Velencei/Tisza-tó/Fertő)
  protected_area jsonb,         -- {"name":..., "rules": {...}}
  season_info jsonb, access_info jsonb, safety_notes jsonb,   -- fordítható
  created_at timestamptz not null default now()
);

create index if not exists spots_geom_idx on public.spots using gist (geom);

create table if not exists public.spot_reports (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid references public.spots not null,
  user_id uuid references public.profiles not null,
  conditions text not null check (conditions in ('nyugodt', 'fodrozodo', 'hullamzo', 'veszelyes')),
  note text, photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists spot_reports_spot_idx on public.spot_reports (spot_id, created_at desc);

alter table public.spots enable row level security;
alter table public.spot_reports enable row level security;

do $$
begin
  -- spots ------------------------------------------------------------------
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='spots' and policyname='spots_public_read') then
    create policy spots_public_read on public.spots for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='spots' and policyname='spots_mod_write') then
    create policy spots_mod_write on public.spots
      for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
  end if;

  -- spot_reports -----------------------------------------------------------
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='spot_reports' and policyname='spot_reports_public_read') then
    create policy spot_reports_public_read on public.spot_reports for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='spot_reports' and policyname='spot_reports_insert_confirmed_own') then
    create policy spot_reports_insert_confirmed_own on public.spot_reports
      for insert to authenticated
      with check (auth.uid() is not null and public.is_email_confirmed() and user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='spot_reports' and policyname='spot_reports_update_own_or_mod') then
    create policy spot_reports_update_own_or_mod on public.spot_reports
      for update to authenticated
      using (user_id = auth.uid() or public.is_moderator())
      with check (user_id = auth.uid() or public.is_moderator());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='spot_reports' and policyname='spot_reports_delete_own_or_mod') then
    create policy spot_reports_delete_own_or_mod on public.spot_reports
      for delete to authenticated using (user_id = auth.uid() or public.is_moderator());
  end if;
end $$;
