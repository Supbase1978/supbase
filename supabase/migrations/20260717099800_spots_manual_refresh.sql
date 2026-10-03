-- ============================================================================
-- SPOTS — spotonkénti KÉZI időjárás-frissítés, visszaélés-biztosan.
-- Modul: spots (a `spots`/`weather_snapshots` táblákra épül, azokhoz nem nyúl).
--
-- HÁTTÉR: a `weather-sync` Edge Function pg_cron-ból fut (élesben, NEM ebben a
-- migrációban beállítva — lásd supabase/functions/README.md), és service-role
-- kulccsal ír `weather_snapshots`-ba. A webszerver (Netlify SSR) SZÁNDÉKOSAN
-- nem kap service-role kulcsot, csak anon/user klienst — ezért a "Frissítsd
-- most" gomb nem hívhatja közvetlenül az Edge Functiont, és nem olvashatja a
-- service-role titkot. A megoldás egy DB-függvény (SECURITY DEFINER), ami:
--   1. nem enged gyakoribb hívást spotonként 10 percnél (Open-Meteo ingyenes
--      keret védelme — lásd a konstans kommentjét lent);
--   2. a Vault-ban tárolt `edge_invoke_key`-jel maga hívja meg a `weather-sync`
--      Edge Functiont (`pg_net`), ugyanazzal az úttal, mint a cron.
--
-- A `spot_refresh_requests` tábla RLS-sel védett, de SZÁNDÉKOSAN nincs rajta
-- policy: kizárólag a `request_spot_refresh()` definer-függvényen át érhető
-- el (az beszúr/frissít emelt jogkörrel) — RLS bekapcsolva + policy nélkül =
-- mindenki más számára zárt (3.2). A `revoke all` a tábla-szintű alapértelmezett
-- jogot is explicit módon elveszi (defense-in-depth, 1:1 a 20260717092000-beli
-- függvény-jogosultsági mintával).
-- ============================================================================

create table if not exists public.spot_refresh_requests (
  spot_id uuid primary key references public.spots(id) on delete cascade,
  requested_at timestamptz not null default now()
);

alter table public.spot_refresh_requests enable row level security;
-- Szándékosan NINCS policy: lásd a fenti fejléc-megjegyzést.

revoke all on public.spot_refresh_requests from anon, authenticated;

comment on table public.spot_refresh_requests is
  'Spotonkénti kézi időjárás-frissítés throttle-nyilvántartása. Policy nélkül zárt — kizárólag a request_spot_refresh() SECURITY DEFINER függvényen át írható/olvasható.';

-- ---------------------------------------------------------------------------
-- spot_refresh_log — a GLOBÁLIS (spotszámtól FÜGGETLEN) 1 órás korláthoz.
--
-- A `spot_refresh_requests` spotonként EGY sort tart (upsert, primary key
-- spot_id) — a legutóbbi kérés idejét, nem a kérések számát. Ezért önmagában
-- NEM alkalmas globális számlálásra: a tábla sorainak száma sosem haladja meg
-- a spotok számát (jelenleg ~15-30), 120-at sosem érne el, a globális korlát
-- némán hatástalan maradna. A `spot_refresh_log` ezzel szemben MINDEN sikeres
-- (nem throttled) kérésről egy új sort ír (append-only napló) — ebből a
-- valódi 1 órás kérés-szám számolható, akárhány spot van is.
-- ---------------------------------------------------------------------------
create table if not exists public.spot_refresh_log (
  id bigint generated always as identity primary key,
  spot_id uuid not null references public.spots(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index if not exists spot_refresh_log_requested_at_idx
  on public.spot_refresh_log (requested_at);

alter table public.spot_refresh_log enable row level security;
-- Szándékosan NINCS policy — ugyanaz a zártsági minta, mint a
-- `spot_refresh_requests`-é (lásd a tábla feletti fejléc-megjegyzést).

revoke all on public.spot_refresh_log from anon, authenticated;

comment on table public.spot_refresh_log is
  'Append-only napló MINDEN sikeres kézi frissítési kérésről (a globális 1 órás korlát számlálásához). Policy nélkül zárt — kizárólag a request_spot_refresh() SECURITY DEFINER függvényen át írható/olvasható. A 24 óránál régebbi sorokat a függvény maga takarítja.';

-- ---------------------------------------------------------------------------
-- request_spot_refresh — az egyetlen út a kézi frissítéshez.
--
-- Visszatérés (text, a hívó UI ebből választ szöveget/ikont — 2. fejezet:
-- állapot szín+ikon+szöveg hármasban, ez a kulcs adja a szöveget):
--   'not_found'   — nincs ilyen spot;
--   'fresh'       — a legutóbbi snapshot 10 percnél nem régebbi, felesleges
--                   újra lekérni;
--   'throttled'   — vagy az előző kérés 10 percen belüli (spotonkénti
--                   throttle, az aszinkron hívás válasza még nem feltétlenül
--                   íródott be snapshotként — ez védi a dupla indítás ellen),
--                   vagy az elmúlt órában a GLOBÁLIS kérés-szám elérte a
--                   küszöböt (lásd `v_global_hourly_limit` lent) — a hívó UI
--                   szövege szándékosan nem tesz különbséget;
--   'unavailable' — a Vault-kulcs hiányzik, NEM hív Edge Functiont;
--   'queued'      — rögzítve + elindítva a weather-sync hívása (pg_net,
--                   aszinkron — a snapshot néhány másodperc múlva jelenik meg).
-- ---------------------------------------------------------------------------
create or replace function public.request_spot_refresh(p_spot_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Open-Meteo ingyenes keret: ~10 000 hívás/nap. A cron 30 percenként fut, ~28
  -- spottal ≈ 1350/nap. A kézi gombbal legrosszabb esetben (10 perces
  -- throttle) spotonként max 6 kérés/óra → 28 spot × 6 × 24 óra ≈ 4000/nap.
  -- A kettő együtt (~5350/nap) is a 10 000-es keret alatt marad.
  v_threshold constant interval := interval '10 minutes';
  -- Globális korlát (spotszámtól FÜGGETLEN védelem — a fenti spotonkénti
  -- számítás sok spotnál vagy sok egyidejű hívónál önmagában nem elég):
  -- legfeljebb 120 kézi kérés rögzíthető óránként összesen, a
  -- `spot_refresh_log` append-only napló alapján számolva. 120/óra ≈
  -- 2880/nap a kézi gombból, plusz a cron ~1350/nap ≈ 4230/nap — jól a
  -- 10 000-es Open-Meteo-keret alatt, akárhány spot/hívó esetén is.
  v_global_hourly_limit constant int := 120;
  v_global_window constant interval := interval '1 hour';
  -- A naplót ennél régebbi sorokról minden híváskor megtisztítjuk (a
  -- `requested_at` index miatt olcsó) — nem kell külön takarító jobot
  -- beállítani hozzá.
  v_log_retention constant interval := interval '1 day';
  v_recent_global_count int;
  v_last_fetch timestamptz;
  v_vault_key text;
  v_recorded boolean;
begin
  if not exists (select 1 from public.spots s where s.id = p_spot_id) then
    return 'not_found';
  end if;

  select max(w.fetched_at) into v_last_fetch
    from public.weather_snapshots w
    where w.spot_id = p_spot_id;

  if v_last_fetch is not null and v_last_fetch > (now() - v_threshold) then
    return 'fresh';
  end if;

  -- Globális korlát a spotonkénti upsert ELŐTT: ha az elmúlt órában már
  -- elérte/túllépte a küszöböt a NAPLÓZOTT kérések száma, a kérés throttled
  -- (nem spot-specifikus — akkor is, ha EZ a spot még nem kért frissítést).
  select count(*) into v_recent_global_count
    from public.spot_refresh_log l
    where l.requested_at > (now() - v_global_window);

  if v_recent_global_count >= v_global_hourly_limit then
    return 'throttled';
  end if;

  -- Atomikus throttle: beszúr, vagy CSAK akkor frissít, ha az előző kérés már
  -- a küszöbön kívül esik. Ha egyik sem (friss kérés már folyamatban), a
  -- `returning` nem ad sort — ez a konkurens dupla-indítás elleni védelem,
  -- mert az aszinkron hívás válasza a snapshotba még nem biztos, hogy beírt.
  with upsert as (
    insert into public.spot_refresh_requests as r (spot_id, requested_at)
    values (p_spot_id, now())
    on conflict (spot_id) do update
      set requested_at = now()
      where r.requested_at < (now() - v_threshold)
    returning 1
  )
  select exists(select 1 from upsert) into v_recorded;

  if not v_recorded then
    return 'throttled';
  end if;

  -- A sikeres spotonkénti upsert UTÁN, a Vault-ellenőrzés/Edge Function-hívás
  -- ELŐTT naplózzuk a kérést (a globális számláláshoz — lásd fent). A
  -- takarítás (1 napnál régebbi sorok törlése) ugyanitt, olcsón, az index
  -- miatt — nem kell külön ütemezett jobot fenntartani hozzá.
  delete from public.spot_refresh_log where requested_at < (now() - v_log_retention);
  insert into public.spot_refresh_log (spot_id, requested_at) values (p_spot_id, now());

  select ds.decrypted_secret into v_vault_key
    from vault.decrypted_secrets ds
    where ds.name = 'edge_invoke_key';

  if v_vault_key is null then
    return 'unavailable';
  end if;

  -- Ugyanaz az URL és Authorization-minta, mint a pg_cron hívásé (kézi,
  -- nem-migrációs SQL — lásd supabase/functions/README.md). Az URL
  -- SZÁNDÉKOSAN égetett, és MINDIG az ÉLES projektet célozza (ez az egyetlen
  -- éles projekt-ref, `pycsqnthxaytwaptbiph` — lásd CLAUDE.md) — ez NEM
  -- környezet-független hívás. Más környezetben (branch/staging DB) ez nem
  -- probléma, mert ott nincs `edge_invoke_key` Vault-titok: a fenti
  -- `v_vault_key is null` ágon `unavailable`-lel visszatérünk ELŐBB, mint
  -- ide érnénk — tehát más környezetből ez a `net.http_post` sosem fut le,
  -- nem hív át (véletlenül) az éles weather-syncbe.
  perform net.http_post(
    url := 'https://pycsqnthxaytwaptbiph.supabase.co/functions/v1/weather-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_vault_key
    ),
    body := jsonb_build_object('spot_ids', jsonb_build_array(p_spot_id))
  );

  return 'queued';
end;
$$;

comment on function public.request_spot_refresh(uuid) is
  'Kézi időjárás-frissítés egy spotra: 10 perces spotonkénti throttle + 120/óra globális korlát + pg_net hívás a weather-sync Edge Functionre (Vault edge_invoke_key). Visszatérés: not_found|fresh|throttled|unavailable|queued.';

-- F1.9 tanulsága (lásd 20260717092000): a public sémában létrehozott függvény
-- alapból PUBLIC-hívható — előbb mindenkitől elvesszük, majd tételesen
-- visszaadjuk. Anon ÉS authenticated egyaránt hívhatja: a kézi frissítés nem
-- felhasználó-tulajdonú tartalom, a spot publikus adat, a visszaélés ellen a
-- throttle (fent) véd, nem a bejelentkezés.
revoke all on function public.request_spot_refresh(uuid) from public;
revoke all on function public.request_spot_refresh(uuid) from anon, authenticated;
grant execute on function public.request_spot_refresh(uuid) to anon, authenticated;
