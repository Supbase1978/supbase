-- ============================================================================
-- MODUL: advisor — advisor_weights (konfig) + advisor_sessions (mérés) (3.1).
-- Idempotens, additív. RLS (3.2):
--   * advisor_weights: publikus olvasás (a SUP-index/Deszkaválasztó kliens is
--     olvassa a súlyokat); írás csak admin (deploy nélküli hangolás, 5. fej.).
--   * advisor_sessions: insert BÁRKINEK (anonim méréshez); select csak saját + admin.
-- ============================================================================

create table if not exists public.advisor_weights (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.advisor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles,          -- nullable: anonim kitöltés
  inputs jsonb not null,        -- {weight, passenger, experience, use, water, budget, storage}
  results jsonb not null,       -- [{board_id, score, reasons[]}]
  clicked_board_id uuid, outcome text,              -- 'bought'|'not_yet'|null
  created_at timestamptz not null default now()
);

alter table public.advisor_weights enable row level security;
alter table public.advisor_sessions enable row level security;

do $$
begin
  -- advisor_weights --------------------------------------------------------
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='advisor_weights' and policyname='advisor_weights_public_read') then
    create policy advisor_weights_public_read on public.advisor_weights for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='advisor_weights' and policyname='advisor_weights_admin_write') then
    create policy advisor_weights_admin_write on public.advisor_weights
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;

  -- advisor_sessions -------------------------------------------------------
  -- Insert bárkinek (anon is): ha van user_id, csak a sajátja lehet.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='advisor_sessions' and policyname='advisor_sessions_insert_any') then
    create policy advisor_sessions_insert_any on public.advisor_sessions
      for insert to anon, authenticated
      with check (user_id is null or user_id = auth.uid());
  end if;
  -- Select: csak saját (ha be van jelentkezve) + admin.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='advisor_sessions' and policyname='advisor_sessions_select_own_or_admin') then
    create policy advisor_sessions_select_own_or_admin on public.advisor_sessions
      for select to authenticated using (user_id = auth.uid() or public.is_admin());
  end if;
end $$;
