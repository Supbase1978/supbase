-- ============================================================================
-- MODUL: weather — `observed_at` a weather_snapshots-ba (F1.3-reviewer m4).
-- Additív, idempotens. RLS változatlan (publikus olvasás, írás csak service_role).
--
-- MIÉRT: a `fetched_at` a MI lekérésünk ideje, az Open-Meteo `current.time`
-- viszont a mérés/modell forrás-időpontja. A kettő eltérhet (modell-futás
-- késése) — az adatkor-szabályhoz (2. fejezet 5.) a forrás-idő a pontosabb.
-- Egyelőre CSAK TÁROLJUK: a stale-számítás továbbra is a fetched_at-ből megy,
-- a váltás külön, tudatos UI-döntés (F1.10 audit).
-- ============================================================================

alter table public.weather_snapshots
  add column if not exists observed_at timestamptz;

comment on column public.weather_snapshots.observed_at is
  'Az adat forrás-időpontja (Open-Meteo current.time). NULL, ha a forrás nem adja (pl. bm-okf viharjelzés-sor).';
