/**
 * Loader/action session-helperek (4. fejezet 4–5. pont).
 *
 * - `getSession` / `getUser`: szerver-oldali olvasás cookie-ból. A `getUser`
 *   a Supabase Auth-nál VALIDÁLJA a tokent (nem csak dekódolja) — jogosultsági
 *   döntést mindig erre alapozunk, nem a nyers cookie-ra.
 * - `requireUser`: guard; nincs session → redirect a belépésre, `redirectTo`
 *   query-vel (a locale-t az aktuális útvonalból számolja).
 * - `requireRole`: a `requireUser` fölé húzott szint-ellenőrzés; elégtelen jog
 *   → 403 (nem redirect a belépésre, hisz be van lépve).
 */
import type { Session, User } from "@supabase/supabase-js";
import { redirect } from "react-router";

import { getLocaleFromPath, localizePath } from "@core/i18n";

import { isSupabaseConfigured } from "./env";
import { defaultRole, hasRole, isRole, type Role } from "./roles";
import { createSupabaseServerClient } from "./supabase.server";

const LOGIN_PATH = "/belepes";

let warnedMissingEnv = false;

/**
 * Fail-closed guard a Supabase-env hiányára: env nélkül nincs session (null),
 * de nem dobunk — így a nyilvános/böngésző-oldalak 500 helyett üres session-nel
 * renderelnek. Egyszeri, beszédes szerveroldali figyelmeztetést írunk.
 */
function supabaseUnavailable(): boolean {
  if (isSupabaseConfigured()) {
    return false;
  }
  if (!warnedMissingEnv) {
    warnedMissingEnv = true;
    console.warn(
      "[auth] Supabase env (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY) nincs beállítva — " +
        "a session-olvasás null-t ad (fail-closed). Állítsd be a .env-et a belépéshez (minta: .env.example).",
    );
  }
  return true;
}

/**
 * NYERS session-olvasás cookie-ból — a token itt NINCS validálva a Supabase
 * Auth-nál. Jogosultsági/auth-döntésre TILOS használni: arra a `getUser` /
 * `requireUser` / `requireRole` való. Ez kizárólag nem-biztonsági célra van
 * (pl. access token továbbadása, UI-hint), hálózati kör nélkül.
 */
export async function getSession(request: Request): Promise<Session | null> {
  if (supabaseUnavailable()) {
    return null;
  }
  const { supabase } = createSupabaseServerClient(request);
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser(request: Request): Promise<User | null> {
  if (supabaseUnavailable()) {
    return null;
  }
  const { supabase } = createSupabaseServerClient(request);
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Csak akkor engedi tovább a nyilvánosnál védettebb loadert/actiont, ha van
 * (validált) user. Nincs → `redirect` a locale-helyes belépőre, az aktuális
 * útvonalat `redirectTo`-ban továbbadva.
 */
export async function requireUser(request: Request): Promise<User> {
  const user = await getUser(request);
  if (!user) {
    throw redirect(buildLoginRedirect(request));
  }
  return user;
}

/**
 * Szint-guard: előbb bejelentkezést vár, majd a szerep-hierarchiát ellenőrzi.
 * Elégtelen jog → 403 Response (a felhasználó be van lépve, nem a belépőre
 * dobjuk vissza).
 *
 * A szerep AUTORITATÍV forrása a `profiles.role`, a `current_user_role()`
 * SECURITY DEFINER helperen át kiolvasva — EZ ugyanaz a forrás, amit az RLS
 * (`is_moderator()`/`is_admin()`) is használ, így az app-réteg és az adatbázis
 * SOHA nem divergál (korábban a `getUserRole` a JWT `app_metadata`-t olvasta,
 * ami eltérhetett a profiles-tól). Ismeretlen/hibás RPC-válasz → fail-closed
 * `defaultRole` (ismeretlen SOHA nem ad emelt jogot).
 */
export async function requireRole(request: Request, required: Role): Promise<User> {
  const user = await requireUser(request);
  const { supabase } = createSupabaseServerClient(request);
  const { data, error } = await supabase.rpc("current_user_role");
  const role = !error && isRole(data) ? data : defaultRole;
  if (!hasRole(role, required)) {
    throw new Response("Forbidden", { status: 403, statusText: "Forbidden" });
  }
  return user;
}

/**
 * A belépő-redirect célja a locale-helyes `/belepes` (hu prefix nélkül, en
 * prefixelten) + `redirectTo` az aktuális útvonalra. Tiszta függvény —
 * tesztelhető a hálózat érintése nélkül.
 */
export function buildLoginRedirect(request: Request): string {
  const url = new URL(request.url);
  const locale = getLocaleFromPath(url.pathname);
  const loginPath = localizePath(LOGIN_PATH, locale);
  const params = new URLSearchParams({ redirectTo: url.pathname + url.search });
  return `${loginPath}?${params.toString()}`;
}

/**
 * Nyílt-redirect elleni védelem: csak app-belső, abszolút útvonalat engedünk
 * (`/...`), a protokoll-relatív `//host` alakot NEM (az külső oldalra vinne).
 * A `/\host` alakot is tiltjuk: a böngészők a Location-fejlécben a `\`-t
 * `/`-re normalizálják, így az a `//host` külső céllal egyenértékű.
 */
export function safeRedirect(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/",
): string {
  const path = typeof value === "string" ? value : "";
  if (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/\\")
  ) {
    return path;
  }
  return fallback;
}
