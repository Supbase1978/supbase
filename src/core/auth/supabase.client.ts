/**
 * Böngésző Supabase-kliens (singleton).
 *
 * A `@supabase/ssr` `createBrowserClient`-je a session-t cookie-ban tartja
 * (nem localStorage-ban), így SSR-kompatibilis a szerver-oldali olvasással.
 * Egyetlen példányt tartunk fenn a lapon belül; az env-hiba (ha nincs env)
 * itt is csak a tényleges HÍVÁSKOR keletkezik, nem modul-szinten.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) {
    return client;
  }
  client = createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
  return client;
}
