-- ============================================================================
-- CORE — push_subscriptions (3.1). A notifications a core-ban él
-- (src/core/notifications), ezért CORE-tábla. Idempotens, additív.
-- RLS (3.2): a user KIZÁRÓLAG a sajátját láthatja/írhatja.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles not null,
  platform text not null check (platform in ('webpush', 'fcm', 'apns')),
  token jsonb not null,
  alert_spot_ids uuid[],       -- mely spotokra kér viharriasztást
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='push_select_own') then
    create policy push_select_own on public.push_subscriptions
      for select to authenticated using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='push_insert_own') then
    create policy push_insert_own on public.push_subscriptions
      for insert to authenticated with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='push_update_own') then
    create policy push_update_own on public.push_subscriptions
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='push_delete_own') then
    create policy push_delete_own on public.push_subscriptions
      for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;
