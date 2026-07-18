-- ============================================================================
-- MODUL: weather — weather_snapshots (3.1). Edge Function tölti, kliens csak olvassa.
-- Idempotens, additív. RLS (3.2): publikus olvasás; ÍRÁS NINCS policy → default
-- deny: kizárólag a service_role (Edge Function) írhat, ami megkerüli az RLS-t.
-- (A stale-logika — 30 perc — a kliens/algo rétegben, nem itt.)
-- ============================================================================

create table if not exists public.weather_snapshots (
  spot_id uuid references public.spots not null,
  fetched_at timestamptz not null default now(),
  wind_kmh numeric, gust_kmh numeric, wind_dir_deg int,
  water_temp_c numeric, air_temp_c numeric, wave_cm int,
  storm_level int not null default 0 check (storm_level in (0, 1, 2)),
  sup_index numeric,            -- számított, 0–10
  source text not null,
  primary key (spot_id, fetched_at)
);

alter table public.weather_snapshots enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='weather_snapshots' and policyname='weather_public_read') then
    create policy weather_public_read on public.weather_snapshots for select using (true);
  end if;
  -- Szándékosan NINCS insert/update/delete policy: csak service_role írhat.
end $$;
