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
-- request_spot_refresh — az egyetlen út a kézi frissítéshez.
--
-- Visszatérés (text, a hívó UI ebből választ szöveget/ikont — 2. fejezet:
-- állapot szín+ikon+szöveg hármasban, ez a kulcs adja a szöveget):
--   'not_found'   — nincs ilyen spot;
--   'fresh'       — a legutóbbi snapshot 10 percnél nem régebbi, felesleges
--                   újra lekérni;
--   'throttled'   — az előző kérés 10 percen belüli, az aszinkron hívás
--                   válasza még nem feltétlenül íródott be snapshotként —
--                   ez védi a dupla indítás ellen;
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

  select ds.decrypted_secret into v_vault_key
    from vault.decrypted_secrets ds
    where ds.name = 'edge_invoke_key';

  if v_vault_key is null then
    return 'unavailable';
  end if;

  -- Ugyanaz az URL és Authorization-minta, mint a pg_cron hívásé (kézi,
  -- nem-migrációs SQL — lásd supabase/functions/README.md).
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
  'Kézi időjárás-frissítés egy spotra: 10 perces throttle + pg_net hívás a weather-sync Edge Functionre (Vault edge_invoke_key). Visszatérés: not_found|fresh|throttled|unavailable|queued.';

-- F1.9 tanulsága (lásd 20260717092000): a public sémában létrehozott függvény
-- alapból PUBLIC-hívható — előbb mindenkitől elvesszük, majd tételesen
-- visszaadjuk. Anon ÉS authenticated egyaránt hívhatja: a kézi frissítés nem
-- felhasználó-tulajdonú tartalom, a spot publikus adat, a visszaélés ellen a
-- throttle (fent) véd, nem a bejelentkezés.
revoke all on function public.request_spot_refresh(uuid) from public;
revoke all on function public.request_spot_refresh(uuid) from anon, authenticated;
grant execute on function public.request_spot_refresh(uuid) to anon, authenticated;
