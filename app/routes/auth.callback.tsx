/**
 * /auth/callback — code-exchange magic linkhez ÉS e-mail-megerősítéshez
 * (4. fejezet 1., 4. pont). A PKCE `code`-ot session-re váltjuk
 * (`exchangeCodeForSession`), a keletkező session-cookie-t a válaszra tesszük,
 * majd a `redirectTo` app-belső célra irányítunk. Hiba → vissza a belépőre
 * beszédes jelzéssel. Nincs saját UI (csak redirect).
 */
import { redirect } from "react-router";

import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { safeRedirect } from "@core/auth/session.server";

import type { Route } from "./+types/auth.callback";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "/");

  if (!code) {
    throw redirect("/belepes?error=callback");
  }

  const { supabase, headers } = createSupabaseServerClient(request);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    throw redirect("/belepes?error=callback");
  }

  return redirect(redirectTo, { headers });
}
