/**
 * /auth/oauth — közösségi belépés indítása (F1.8b). Resource route (action-only):
 * a `/belepes` és `/regisztracio` OAuthButtons-a ide POST-olja a providert
 * (google|apple). A Supabase `signInWithOAuth` a provider-URL-t adja vissza (a
 * PKCE code-verifier a Set-Cookie-ban), ide irányítunk; a visszatérést a MEGLÉVŐ
 * `/auth/callback` kezeli (exchangeCodeForSession) — nem kell külön callback.
 *
 * Megjegyzés: a provider a Supabase Dashboardban engedélyezendő (Google Cloud
 * OAuth-kliens; Apple Services ID). Bekapcsolásig a redirect a Supabase-nél hibára
 * fut — a gombok kódból készen állnak.
 */
import { redirect, type ActionFunctionArgs } from "react-router";

import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { safeRedirect } from "@core/auth/session.server";

const OAUTH_PROVIDERS = ["google", "apple"] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** GET-re nincs teendő — vissza a belépőre. */
export async function loader() {
  return redirect("/belepes");
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const provider = String(formData.get("provider") ?? "");
  const redirectTo = safeRedirect(formData.get("redirectTo"), "/");

  if (!isOAuthProvider(provider)) {
    throw redirect("/belepes?error=oauth");
  }

  const { supabase, headers } = createSupabaseServerClient(request);
  const origin = new URL(request.url).origin;
  const callbackUrl = `${origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl },
  });

  if (error || !data?.url) {
    throw redirect("/belepes?error=oauth");
  }

  // A provider bejelentkező-oldalára irányítunk; a code-verifier a headers-ben utazik.
  return redirect(data.url, { headers });
}
