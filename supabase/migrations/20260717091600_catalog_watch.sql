-- ============================================================================
-- MODUL: catalog — catalog-watch séma-előkészítés (docs/CATALOG_WATCH_TERV.md).
-- ÚJ migráció, additív: az F1.2-es catalog-migrációt NEM bolygatja.
--   * boards életciklus-mezők (status + first/last_seen + discontinued_at).
--   * catalog_sources — figyelt források (kézi felvitel elsőrangú).
--   * catalog_candidates — crawl-jelöltek admin-jóváhagyási sorral.
--   * pg_trgm — fuzzy modell-egyezéshez (dedup magja).
-- RLS: a catalog-watch táblák KURÁLT/BELSŐ tartalom — select ÉS write csak
-- moderator/admin (nincs publikus olvasás; a jelöltek nem közönségnek szólnak).
-- Idempotens, additív.
-- ============================================================================

create extension if not exists pg_trgm;

-- --- boards életciklus-mezők -------------------------------------------------
alter table public.boards
  add column if not exists status text not null default 'active'
    check (status in ('active', 'discontinued', 'unverified'));
alter table public.boards
  add column if not exists first_seen_at timestamptz not null default now();
alter table public.boards
  add column if not exists last_seen_at timestamptz;
alter table public.boards
  add column if not exists discontinued_at timestamptz;

-- Fuzzy modell-név egyezés (catalog-watch dedup) — trigram GIN index.
create index if not exists boards_model_trgm
  on public.boards using gin (model_name gin_trgm_ops);

-- --- catalog_sources ---------------------------------------------------------
create table if not exists public.catalog_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text,
  kind text not null check (kind in ('brand_site', 'shop', 'feed')),
  country text not null default 'HU',
  discovery text not null default 'manual' check (discovery in ('manual', 'search')),
  crawl_config jsonb,                       -- sitemap-URL, feed-URL, megjegyzések
  active boolean not null default true,
  last_crawled_at timestamptz,
  added_by uuid references public.profiles,
  created_at timestamptz not null default now()
);

-- --- catalog_candidates ------------------------------------------------------
create table if not exists public.catalog_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.catalog_sources not null,
  url text,
  raw jsonb,                                -- nyers JSON-LD / extrakció
  extracted jsonb,                          -- normalizált spec
  matched_board_id uuid references public.boards,
  match_confidence numeric,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'merged')),
  reviewed_by uuid references public.profiles,
  created_at timestamptz not null default now()
);

create index if not exists catalog_candidates_source_idx
  on public.catalog_candidates (source_id, created_at desc);
create index if not exists catalog_candidates_status_idx
  on public.catalog_candidates (status);

alter table public.catalog_sources enable row level security;
alter table public.catalog_candidates enable row level security;

do $$
begin
  -- catalog_sources: select + write csak moderator/admin (for all → select is) --
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='catalog_sources' and policyname='catalog_sources_mod_all') then
    create policy catalog_sources_mod_all on public.catalog_sources
      for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
  end if;

  -- catalog_candidates: select + write csak moderator/admin --------------------
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='catalog_candidates' and policyname='catalog_candidates_mod_all') then
    create policy catalog_candidates_mod_all on public.catalog_candidates
      for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
  end if;
end $$;

comment on table public.catalog_sources is
  'catalog-watch figyelt források (kézi felvitel elsőrangú). RLS: csak moderator/admin.';
comment on table public.catalog_candidates is
  'catalog-watch crawl-jelöltek admin-jóváhagyási sorral. RLS: csak moderator/admin.';
comment on column public.boards.status is
  'Életciklus: active | discontinued (kifutott, nem törlődik) | unverified (jelölt-eredetű).';
