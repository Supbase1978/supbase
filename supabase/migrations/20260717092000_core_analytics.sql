-- ============================================================================
-- CORE: süti- és azonosító-mentes használati statisztika (12/6, F1.12).
--
-- MIÉRT ÍGY, ÉS MIT NEM CSINÁLUNK:
-- Az adatvédelmi tájékoztatónk azt ígéri, hogy analitikai SÜTI csak külön
-- hozzájárulással kerül elhelyezésre. Ezért itt NINCS süti, NINCS eszköz-
-- azonosító, NINCS IP-cím és NINCS látogató-azonosító (még napi rotációjú
-- hash sem). Következmény, amit tudomásul veszünk: EGYÉNI tölcsér nem
-- mérhető — csak azt látjuk, hogy egy adott lépés hányszor történt meg,
-- nem azt, hogy UGYANAZ az ember jutott-e tovább. A kérdéseink többsége
-- (hányan indítják el a deszkaválasztót, hányszor születik eredmény) így is
-- megválaszolható, és ez az adat nem alkalmas személy azonosítására.
--
-- ÍRÁS: kizárólag a `record_analytics_event()` SECURITY DEFINER függvényen át.
-- A táblára NINCS insert-policy, tehát közvetlenül senki nem írhat: az
-- eseménynév és az útvonal alakja a függvényben ÉS kényszerekben is validált.
-- OLVASÁS: csak admin.
-- ============================================================================

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  name text not null,
  -- Útvonal QUERY NÉLKÜL. A query-t szándékosan eldobjuk: a deszkaválasztó
  -- megosztható linkje testsúlyt és magasságot tartalmaz, aminek a
  -- statisztikában semmi keresnivalója.
  path text,
  props jsonb not null default '{}'::jsonb
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_events_name_check') then
    alter table public.analytics_events add constraint analytics_events_name_check
      check (name in (
        'page_view',
        'advisor_wizard_view',
        'advisor_result_view',
        'advisor_submitted',
        'review_submitted',
        'report_submitted',
        'lead_sent',
        'provider_created',
        'push_subscribed'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'analytics_events_path_check') then
    alter table public.analytics_events add constraint analytics_events_path_check
      check (path is null or path ~ '^/[A-Za-z0-9/_.\-]{0,120}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'analytics_events_props_check') then
    -- Méret-korlát: a props CÍMKÉZÉSRE való (pl. {"water":"folyo"}), nem
    -- adattárolásra. A korlát megakadályozza, hogy bármi terjedelmes
    -- (vagy személyes) beszivárogjon rajta.
    alter table public.analytics_events add constraint analytics_events_props_check
      check (pg_column_size(props) <= 512);
  end if;
end $$;

create index if not exists analytics_events_occurred_idx
  on public.analytics_events (occurred_at desc);

alter table public.analytics_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'analytics_events'
      and policyname = 'analytics_admin_read'
  ) then
    create policy analytics_admin_read on public.analytics_events
      for select using (public.is_admin());
  end if;
  -- Szándékosan NINCS insert/update/delete policy: írni csak a definer
  -- függvénnyel lehet, törölni/módosítani senki nem tud a REST-en át.
end $$;

comment on table public.analytics_events is
  'Süti- és azonosító-mentes használati események. Nincs IP, nincs látogató-azonosító — egyéni tölcsér ezért NEM mérhető, csak esemény-darabszám.';

-- ---------------------------------------------------------------------------
-- Az EGYETLEN írási út. Definer, mert a hívónak (anon/authenticated) nincs és
-- ne is legyen közvetlen insert-joga a táblára.
-- ---------------------------------------------------------------------------
create or replace function public.record_analytics_event(
  p_name text,
  p_path text default null,
  p_props jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  -- A query-részt itt is levágjuk: ha a hívó mégis teljes URL-t küldene,
  -- a személyes paraméterek (testsúly, magasság) NEM kerülhetnek be.
  v_path := split_part(coalesce(p_path, ''), '?', 1);
  if v_path = '' then
    v_path := null;
  end if;

  -- Ismeretlen eseménynév: csendben eldobjuk. A statisztika sosem lehet ok
  -- arra, hogy egy kérés hibára fusson.
  if p_name not in (
    'page_view', 'advisor_wizard_view', 'advisor_result_view', 'advisor_submitted',
    'review_submitted', 'report_submitted', 'lead_sent', 'provider_created', 'push_subscribed'
  ) then
    return;
  end if;

  insert into public.analytics_events (name, path, props)
  values (
    p_name,
    v_path,
    case when pg_column_size(coalesce(p_props, '{}'::jsonb)) <= 512
         then coalesce(p_props, '{}'::jsonb)
         else '{}'::jsonb end
  );
end;
$$;

-- F1.9 TANULSÁGA: a public sémában létrehozott függvény ALAPBÓL anon-hívható a
-- Supabase `alter default privileges` beállítása miatt, és a `revoke ... from
-- public` ezt NEM veszi el. Ezért itt explicit a teljes jogosultság-kép: előbb
-- mindenkitől elvesszük, majd tételesen visszaadjuk.
revoke all on function public.record_analytics_event(text, text, jsonb) from public;
revoke all on function public.record_analytics_event(text, text, jsonb) from anon, authenticated;
-- Az SSR-réteg a kérés saját (anon vagy authenticated) jogaival hív, ezért
-- mindkét szerepnek kell EXECUTE. Ez egyben azt is jelenti, hogy az esemény-
-- végpont kívülről is hívható — mint minden webes analitikánál. A kockázat
-- statisztika-szennyezés (nem adatszivárgás), a validálás pedig itt van.
grant execute on function public.record_analytics_event(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Napi összesítő nézet az admin-felülethez. `security_invoker`: a hívó
-- jogaival olvas, tehát az alaptábla admin-only policy-ja érvényes.
-- ---------------------------------------------------------------------------
create or replace view public.analytics_daily
with (security_invoker = on) as
select
  (occurred_at at time zone 'Europe/Budapest')::date as day,
  name,
  count(*)::bigint as events
from public.analytics_events
group by 1, 2;

comment on view public.analytics_daily is
  'Napi esemény-darabszám (Europe/Budapest naptári nap szerint). Olvasás: csak admin, az alaptábla RLS-én át.';

grant select on public.analytics_daily to authenticated;
