/**
 * `@core/auth` publikus felület (F1.1, 4. fejezet).
 *
 * FONTOS a szerver/kliens határ miatt: ez a barrel csak az IZOMORF és
 * KLIENS-BIZTOS API-t exportálja. A `*.server.ts` modulokat (SSR-kliens,
 * session-guardok) a route-loaderek/actionök KÖZVETLENÜL a saját útvonalukról
 * importálják:
 *   - `@core/auth/supabase.server` → createSupabaseServerClient
 *   - `@core/auth/session.server`  → getSession, getUser, requireUser,
 *                                     requireRole, buildLoginRedirect, safeRedirect
 * Így a szerver-only kód sosem kerülhet a kliens-bundle-be a barrelen át.
 */

// Szerepek / jogosultság (izomorf).
export { roles, defaultRole, isRole, hasRole, getUserRole, type Role } from "./roles";

// E-mail-megerősítés UX-helper (izomorf).
export { isEmailConfirmed } from "./email-confirmed";

// Env-hozzáférés (izomorf, VITE_ prefixű publikus értékek).
export {
  getSupabaseUrl,
  getSupabaseAnonKey,
  isSupabaseConfigured,
  getTurnstileSiteKey,
  isTurnstileEnabled,
} from "./env";

// Böngésző Supabase-kliens (kliens-oldal).
export { getSupabaseBrowserClient } from "./supabase.client";

// Turnstile widget (kliens-oldal, npm-függőség nélkül).
export { Turnstile, TURNSTILE_RESPONSE_FIELD, type TurnstileProps } from "./turnstile";

// GDPR fiók-törlés váz (kliens-oldal).
export { deleteAccount, NotImplementedError, DELETE_ACCOUNT_FUNCTION } from "./gdpr";

// Csak a SzerverContext TÍPUSA (fordításkor törlődik, nincs runtime-import).
export type { SupabaseServerContext } from "./supabase.server";
