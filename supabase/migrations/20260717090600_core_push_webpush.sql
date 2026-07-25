-- ============================================================================
-- CORE — push_subscriptions bővítés a Web Pushhoz (F1.9, 9. fejezet).
-- Additív, idempotens: a F1.2-beli tábla és RLS-policyk VÁLTOZATLANOK.
--
-- Mit ad hozzá:
--   1. `endpoint` generált oszlop (a jsonb tokenből) + UNIQUE index — egy
--      böngésző-endpoint pontosan egy sor. Nélküle a többszöri feliratkozás
--      duplikálna, és a felhasználó több példányban kapná a riasztást.
--   2. GIN index az `alert_spot_ids`-re — a storm-alert `&&` (overlaps)
--      célzó lekérdezéséhez.
--   3. `updated_at` — mikor frissült a feliratkozás (spot-lista módosítás).
--   4. `upsert_push_subscription()` SECURITY DEFINER RPC: eszköz-átvétel.
--      Ha ugyanaz az endpoint MÁS user nevén szerepel (közös gép, fiókváltás),
--      a régi sort törölni kell — ezt RLS alatt a hívó nem tudná megtenni,
--      ezért definer-jogkör kell hozzá. Az ÍRÁS továbbra is csak a saját
--      nevében történhet (a függvény auth.uid()-ot használ, nem paramétert).
-- ============================================================================

alter table public.push_subscriptions
  add column if not exists endpoint text
    generated always as (token ->> 'endpoint') stored;

alter table public.push_subscriptions
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists push_subscriptions_endpoint_uniq
  on public.push_subscriptions (endpoint)
  where endpoint is not null;

create index if not exists push_subscriptions_alert_spots_idx
  on public.push_subscriptions using gin (alert_spot_ids);

-- ---------------------------------------------------------------------------
-- Feliratkozás létrehozása/frissítése. A user_id MINDIG auth.uid() — a hívó
-- nem tud más nevében feliratkozni. A spot-lista explicit opt-in (üres lista =
-- nem kap riasztást; a küldő oldal is így értelmezi).
-- ---------------------------------------------------------------------------
create or replace function public.upsert_push_subscription(
  p_token jsonb,
  p_spot_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_endpoint text := p_token ->> 'endpoint';
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Bejelentkezés szükséges' using errcode = '42501';
  end if;
  if v_endpoint is null or v_endpoint = '' then
    raise exception 'Érvénytelen push-token (nincs endpoint)' using errcode = '22023';
  end if;
  if (p_token ->> 'keys') is null and (p_token ->> 'p256dh') is null then
    raise exception 'Érvénytelen push-token (nincsenek kulcsok)' using errcode = '22023';
  end if;

  -- Eszköz-átvétel: ugyanaz a böngésző-endpoint másik fiókkal jelentkezett be.
  delete from public.push_subscriptions
    where endpoint = v_endpoint and user_id <> v_user_id;

  insert into public.push_subscriptions (user_id, platform, token, alert_spot_ids)
    values (v_user_id, 'webpush', p_token, coalesce(p_spot_ids, '{}'::uuid[]))
  on conflict (endpoint) where endpoint is not null do update
    set token = excluded.token,
        alert_spot_ids = excluded.alert_spot_ids,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_push_subscription(jsonb, uuid[]) from public;
grant execute on function public.upsert_push_subscription(jsonb, uuid[]) to authenticated;
