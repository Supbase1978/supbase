/**
 * isServiceRoleRequest — a cron/DB-indított (service_role) hívások
 * megkülönböztetése a bejelentkezett/anon userek hívásaitól.
 *
 * KONTEXTUS: a Supabase gateway `verify_jwt = true` beállítása CSAK az
 * aláírást ellenőrzi — bármely érvényes projekt-JWT (akár egy bejelentkezett
 * user access tokenje) átmegy rajta. A `weather-sync` és `storm-alert` Edge
 * Functionöket viszont KIZÁRÓLAG a pg_cron és a `request_spot_refresh()`
 * SECURITY DEFINER DB-függvény hívhatja (service_role JWT, Vault
 * `edge_invoke_key`) — másnak nincs dolga itt (service-role kulcsot
 * megkerülve írnak a `weather_snapshots`-ba).
 *
 * Mivel az aláírást a gateway MÁR igazolta (verify_jwt), itt elég a `role`
 * claimet kiolvasni a payloadból (2. szegmens) — NEM kell újra ellenőrizni az
 * aláírást. Ez a függvény szándékosan NEM kriptográfiai ellenőrzés, csak
 * egy gyors, gateway UTÁNI védelmi réteg (defense-in-depth).
 *
 * Deno ÉS Node alatt is fut (`_shared` = runtime-semleges, lásd README):
 * `atob` mindkét környezetben globális; a base64url→base64 átalakítás
 * (`-`/`_` csere + padding) kézzel történik, mert az `atob` sima base64-et
 * vár.
 */

function base64UrlDecode(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return atob(padded);
  } catch {
    return null;
  }
}

/**
 * `Bearer <jwt>` Authorization-fejlécből kiolvassa, hogy a token `role`
 * claimje `service_role`-e. Bármilyen hiba (hiányzó fejléc, rossz alak,
 * érvénytelen base64, nem JSON payload, hiányzó `role`) → `false`.
 */
export function isServiceRoleRequest(authorizationHeader: string | null): boolean {
  if (!authorizationHeader) return false;

  const match = /^Bearer\s+(.+)$/.exec(authorizationHeader.trim());
  if (!match) return false;
  const jwt = match[1];
  if (!jwt) return false;

  const segments = jwt.split(".");
  if (segments.length !== 3) return false;
  const payloadSegment = segments[1];
  if (!payloadSegment) return false;

  const decoded = base64UrlDecode(payloadSegment);
  if (decoded === null) return false;

  let payload: unknown;
  try {
    payload = JSON.parse(decoded);
  } catch {
    return false;
  }

  if (typeof payload !== "object" || payload === null) return false;
  const role = (payload as Record<string, unknown>).role;
  return role === "service_role";
}
