-- ============================================================================
-- CORE — az `upsert_push_subscription()` RPC jogosultság-szigorítása (F1.9-utó).
--
-- MIÉRT: az éles verifikáció kimutatta, hogy a `revoke all ... from public` +
-- `grant execute to authenticated` NEM zárja ki az anon szerepet — a Supabase
-- `alter default privileges` beállítása a public sémában LÉTREHOZÁSKOR explicit
-- EXECUTE-ot ad anon/authenticated/service_role szerepnek, és azt a PUBLIC-ról
-- való revoke nem érinti. Anonim hívásnál eddig a függvényen BELÜLI
-- `auth.uid() is null` guard fogott (42501) — helyes viselkedés, de a
-- védelemnek már a jogosultsági rétegben is állnia kell (defense in depth).
--
-- Idempotens: a revoke nem létező jogosultságra is hibátlanul lefut.
-- ============================================================================

revoke execute on function public.upsert_push_subscription(jsonb, uuid[]) from anon;

-- A service_role az Edge Functionből az RLS-t megkerülve ír; ehhez az RPC-re
-- nincs szüksége (a storm-alert csak OLVAS és TÖRÖL feliratkozásokat).
revoke execute on function public.upsert_push_subscription(jsonb, uuid[]) from service_role;
