-- Explicit Data API jogosultságok (Supabase 2026-10-30-i változás).
--
-- Október 30-tól a Supabase a `public` sémában LÉTREHOZOTT új táblákhoz/nézetekhez
-- nem ad automatikusan jogot az anon/authenticated/service_role szerepeknek (a
-- korábbi `alter default privileges` eltűnik). Enélkül a supabase-js/PostgREST
-- "permission denied"-et kap. Ez a friss projekteket, preview-ágakat és a
-- `supabase db reset`-et érinti; a MEGLÉVŐ éles táblák jogai változatlanok.
--
-- Ez a migráció rögzíti az élesben mért jogképet (2026-10-23), így egy tiszta
-- újraépítés ugyanazt adja. A tényleges védelem továbbra is az RLS: a jogok
-- szándékosan az élő állapotot tükrözik (idempotens, élesben no-op).
-- ÚJ TÁBLÁNÁL a saját migráció végére kötelező a `grant` (ld. grants.test.ts).
--
-- A spot_refresh_log / spot_refresh_requests szándékosan csak service_role-é.

grant all on table
  public.advisor_sessions,
  public.advisor_weights,
  public.analytics_events,
  public.board_prices,
  public.board_reviews,
  public.boards,
  public.brands,
  public.catalog_candidates,
  public.catalog_sources,
  public.feedback,
  public.orders,
  public.profiles,
  public.provider_leads,
  public.provider_spots,
  public.providers,
  public.push_subscriptions,
  public.review_flags,
  public.spot_reports,
  public.spots,
  public.user_consents,
  public.weather_snapshots
to anon, authenticated, service_role;

-- Nézetek (olvasásra használjuk őket; az élő állapot egyezése miatt itt is all).
grant all on table
  public.analytics_daily,
  public.latest_weather_snapshots,
  public.profiles_public
to anon, authenticated, service_role;

grant all on table
  public.spot_refresh_log,
  public.spot_refresh_requests
to service_role;
