/**
 * /kijelentkezes — POST-only action: signOut + redirect (4. fejezet 4. pont).
 * A GET-et a loader a kezdőlapra tereli (a kijelentkezés csak explicit
 * POST-tal történhet, hogy prefetch/link-bejárás ne léptessen ki senkit).
 * A cél a form `redirectTo` mezőjéből jön (pl. locale-helyes kezdőlap),
 * a safeRedirect nyílt-redirect-szűrőjén át.
 */
import { redirect } from "react-router";

import { safeRedirect } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";

import type { Route } from "./+types/kijelentkezes";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const target = safeRedirect(formData.get("redirectTo"));
  const { supabase, headers } = createSupabaseServerClient(request);
  await supabase.auth.signOut();
  return redirect(target, { headers });
}

export function loader() {
  return redirect("/");
}
