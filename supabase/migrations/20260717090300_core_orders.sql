-- ============================================================================
-- CORE — orders (payments-ready, 3.1 + 7. fejezet). F1-ben üres, séma lefoglalva.
-- A payments a core-ban él (src/core/payments), ezért ez CORE-tábla, nem modul-tábla.
-- Idempotens, additív. RLS: csak saját sor (+ admin); írás jellemzően service_role.
-- ============================================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles not null,
  kind text not null check (kind in ('booking', 'subscription', 'listing_upgrade')),
  -- Fizetési életciklus (7. fej.). Új rendelés 'pending'; a további állapotokat a
  -- szerver (service_role / Stripe-webhook) lépteti — lásd protect_order_columns.
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  amount_huf int,
  currency text default 'HUF',
  provider_ref text,        -- Stripe payment intent / subscription id (F3)
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

-- ---------------------------------------------------------------------------
-- Column-védelem: a fizetési STÁTUSZT és a külső referenciát (provider_ref)
-- KIZÁRÓLAG a szerver állíthatja (admin vagy service_role). A user legfeljebb azt
-- adja meg, MIT rendel (kind/amount_huf/currency/payload); a pénzmozgás eredményét
-- (status='paid'/'failed'/…) nem hamisíthatja, és utólag a rendelést sem írhatja át.
-- ---------------------------------------------------------------------------
create or replace function public.protect_order_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  -- Privilegizált író: admin (profiles.role) VAGY service_role (Edge Function/webhook).
  if not (public.is_admin() or v_jwt_role = 'service_role') then
    if tg_op = 'INSERT' then
      new.status := 'pending';        -- új rendelés mindig fizetésre vár
      new.provider_ref := null;       -- külső referenciát csak a szerver tölt
    else
      new.status := old.status;       -- user nem léptetheti az állapotot
      new.provider_ref := old.provider_ref;
      new.amount_huf := old.amount_huf;
      new.currency := old.currency;
      new.kind := old.kind;           -- a rendelés típusa utólag nem írható át
      new.user_id := old.user_id;     -- tulajdonos-átírás tiltva
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'protect_order_columns_trg' and not tgisinternal
  ) then
    create trigger protect_order_columns_trg
      before insert or update on public.orders
      for each row execute function public.protect_order_columns();
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_select_own') then
    create policy orders_select_own on public.orders
      for select to authenticated using (user_id = auth.uid() or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_insert_own') then
    create policy orders_insert_own on public.orders
      for insert to authenticated with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_update_own_or_admin') then
    create policy orders_update_own_or_admin on public.orders
      for update to authenticated
      using (user_id = auth.uid() or public.is_admin())
      with check (user_id = auth.uid() or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_delete_admin') then
    create policy orders_delete_admin on public.orders
      for delete to authenticated using (public.is_admin());
  end if;
end $$;
