-- ============================================================================
-- MODUL: catalog — brands, boards, board_prices (3.1).
-- A modul-szerződés (1.3): a catalog a SAJÁT migrációjában hozza a tábláit.
-- Idempotens, additív. RLS (3.2): publikus olvasás; írás csak moderator/admin
-- (a katalógus kurált tartalom).
-- ============================================================================

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  website_url text
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands not null,
  model_name text not null,
  model_year int,                         -- évjárat/verzió (Totalcar-analógia)
  slug jsonb not null,                    -- {"hu":"...","en":"..."} — SEO
  board_type text not null check (board_type in
    ('allround', 'touring', 'race', 'yoga', 'kids', 'fishing', 'river')),
  length_cm int, width_cm int, thickness_cm int, volume_l int, weight_kg numeric,
  rider_weight_min_kg int, rider_weight_max_kg int, max_load_kg int,
  inflatable boolean not null default true,
  description jsonb,                       -- fordítható
  manual_url text, image_url text,
  availability_hu boolean not null default false,
  stability_index numeric generated always as
    (round((width_cm * 0.5 + thickness_cm * 2 + volume_l * 0.05)::numeric, 1)) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.board_prices (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references public.boards not null,
  shop_name text not null, url text, price_huf int not null,
  recorded_at timestamptz not null default now()
);

create index if not exists board_prices_board_idx on public.board_prices (board_id, recorded_at desc);

alter table public.brands enable row level security;
alter table public.boards enable row level security;
alter table public.board_prices enable row level security;

do $$
begin
  -- brands -----------------------------------------------------------------
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='brands' and policyname='brands_public_read') then
    create policy brands_public_read on public.brands for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='brands' and policyname='brands_mod_write') then
    create policy brands_mod_write on public.brands
      for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
  end if;

  -- boards -----------------------------------------------------------------
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='boards' and policyname='boards_public_read') then
    create policy boards_public_read on public.boards for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='boards' and policyname='boards_mod_write') then
    create policy boards_mod_write on public.boards
      for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
  end if;

  -- board_prices -----------------------------------------------------------
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='board_prices' and policyname='board_prices_public_read') then
    create policy board_prices_public_read on public.board_prices for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='board_prices' and policyname='board_prices_mod_write') then
    create policy board_prices_mod_write on public.board_prices
      for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
  end if;
end $$;
