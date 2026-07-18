-- ============================================================================
-- MODUL: reviews — board_reviews (Népítélet) + review_flags (3.1).
-- Idempotens, additív. Kiemelt követelmények (3.2 + 4. fej.):
--   * insert csak bejelentkezve + MEGERŐSÍTETT e-maillel (is_email_confirmed).
--   * update/delete csak saját sor; moderator elrejthet/moderálhat.
--   * verified_owner ÉS status user-oldali update-ből NEM módosítható
--     (column-szintű trigger-védelem) — a jelvényt user SOHA nem állíthatja.
-- ============================================================================

create table if not exists public.board_reviews (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references public.boards not null,
  user_id uuid references public.profiles not null,
  rating_overall int not null check (rating_overall between 1 and 5),
  rating_stability int check (rating_stability between 1 and 5),
  rating_glide int check (rating_glide between 1 and 5),
  rating_build int check (rating_build between 1 and 5),
  rating_value int check (rating_value between 1 and 5),
  text_pros text, text_cons text,
  used_water_type text check (used_water_type in ('to', 'folyo', 'tenger')),
  used_rider_weight_kg int, used_experience text,
  verified_owner boolean not null default false,   -- csak moderator/admin állíthatja
  status text not null default 'published'
    check (status in ('published', 'hidden', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, user_id)                        -- 1 user = 1 vélemény / deszka
);

create index if not exists board_reviews_board_idx on public.board_reviews (board_id);

create table if not exists public.review_flags (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.board_reviews not null,
  flagged_by uuid references public.profiles not null,
  reason text not null check (reason in ('spam', 'offensive', 'fake', 'other')),
  note text, resolved boolean not null default false,
  resolved_by uuid references public.profiles,
  created_at timestamptz not null default now()
);

alter table public.board_reviews enable row level security;
alter table public.review_flags enable row level security;

-- ---------------------------------------------------------------------------
-- Column-védelem: verified_owner + status csak moderator/admin update-ből;
-- nem-moderátor update visszaállítja az OLD értékeket, és frissíti updated_at-ot.
-- ---------------------------------------------------------------------------
create or replace function public.protect_review_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    new.verified_owner := old.verified_owner;
    new.status := old.status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'protect_review_columns_trg' and not tgisinternal
  ) then
    create trigger protect_review_columns_trg
      before update on public.board_reviews
      for each row execute function public.protect_review_columns();
  end if;
end $$;

do $$
begin
  -- board_reviews ----------------------------------------------------------
  -- Publikus olvasás csak publikált; a szerző és a moderátor a sajátját/összeset.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='board_reviews' and policyname='reviews_read_published_or_own') then
    create policy reviews_read_published_or_own on public.board_reviews
      for select using (status = 'published' or user_id = auth.uid() or public.is_moderator());
  end if;

  -- Írás-gate: bejelentkezve + megerősített e-mail + saját sor.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='board_reviews' and policyname='reviews_insert_confirmed_own') then
    create policy reviews_insert_confirmed_own on public.board_reviews
      for insert to authenticated
      with check (auth.uid() is not null and public.is_email_confirmed() and user_id = auth.uid());
  end if;

  -- Saját vélemény szerkesztése (verified_owner/status a triggerben védve).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='board_reviews' and policyname='reviews_update_own') then
    create policy reviews_update_own on public.board_reviews
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  -- Moderátor: bármely véleményt moderálhat (elrejt, jelvényt ad).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='board_reviews' and policyname='reviews_update_mod') then
    create policy reviews_update_mod on public.board_reviews
      for update to authenticated using (public.is_moderator()) with check (public.is_moderator());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='board_reviews' and policyname='reviews_delete_own_or_mod') then
    create policy reviews_delete_own_or_mod on public.board_reviews
      for delete to authenticated using (user_id = auth.uid() or public.is_moderator());
  end if;

  -- review_flags -----------------------------------------------------------
  -- Bejelentő a sajátját látja; moderátor mindet.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_flags' and policyname='flags_read_own_or_mod') then
    create policy flags_read_own_or_mod on public.review_flags
      for select to authenticated using (flagged_by = auth.uid() or public.is_moderator());
  end if;

  -- Flag csak megerősített e-maillel, saját néven.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_flags' and policyname='flags_insert_confirmed_own') then
    create policy flags_insert_confirmed_own on public.review_flags
      for insert to authenticated
      with check (auth.uid() is not null and public.is_email_confirmed() and flagged_by = auth.uid());
  end if;

  -- Feloldás (resolved) csak moderátor.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_flags' and policyname='flags_update_mod') then
    create policy flags_update_mod on public.review_flags
      for update to authenticated using (public.is_moderator()) with check (public.is_moderator());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_flags' and policyname='flags_delete_mod') then
    create policy flags_delete_mod on public.review_flags
      for delete to authenticated using (public.is_moderator());
  end if;
end $$;
