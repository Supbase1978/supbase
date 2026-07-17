/**
 * SSR Supabase-kliens (4. fejezet 4. pont).
 *
 * Kérésenként ÚJ klienst gyártunk (soha nem osztunk meg klienst kérések
 * között — különben az egyik felhasználó session-je átszivárogna a másikhoz).
 * A session cookie-alapú (`@supabase/ssr`), a token SOHA nem localStorage-ban:
 * a `getAll` a bejövő `Cookie` fejlécből olvas, a `setAll` a token-frissítéskor
 * keletkező Set-Cookie fejléceket egy `Headers`-be gyűjti, amit a loader/action
 * a válaszához csatol (`{ supabase, headers }`).
 */
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export interface SupabaseServerContext {
  supabase: SupabaseClient;
  /** A válaszhoz csatolandó Set-Cookie (és cache-tiltó) fejlécek. */
  headers: Headers;
}

/**
 * SSR Supabase-kliens az adott RR7 `Request`-hez. A visszaadott `headers`-t a
 * hívó loader/action KÖTELEZŐEN visszaadja a válaszában (redirect/data init),
 * különben a frissített session-cookie elveszik.
 */
export function createSupabaseServerClient(request: Request): SupabaseServerContext {
  const headers = new Headers();

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
        }
      },
    },
  });

  return { supabase, headers };
}
