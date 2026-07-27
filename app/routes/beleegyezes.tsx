/**
 * /beleegyezes — retroaktív re-consent felület (F1.8). A jogi szöveg
 * verzió-emelésekor (CONSENT_VERSION) a meglévő userek ide jutnak (a root-banner
 * innen linkel), és egy kattintással elfogadják az aktuális ÁSZF-et + adatvédelmi
 * tájékoztatót. A naplózás append-only (user_consents); a user_id a session-ből.
 */
import { useTranslation } from "react-i18next";
import { data, Form, Link, redirect } from "react-router";

import { APP_NAME } from "@core/brand";
import { requireUser, safeRedirect } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { REQUIRED_CONSENT_KINDS } from "@core/consent/config";
import { getMissingRequiredConsents, recordConsents } from "@core/consent/consent.server";
import { Button, Card } from "@core/ui";

import type { Route } from "./+types/beleegyezes";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { supabase } = createSupabaseServerClient(request);
  const missing = await getMissingRequiredConsents(supabase, user.id);
  const redirectTo = safeRedirect(new URL(request.url).searchParams.get("redirectTo"), "/");
  return { upToDate: missing.length === 0, redirectTo };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();
  const redirectTo = safeRedirect(formData.get("redirectTo"), "/");

  const result = await recordConsents(supabase, user.id, REQUIRED_CONSENT_KINDS);
  if (!result.ok) {
    return data({ ok: false as const }, { headers });
  }
  return redirect(redirectTo, { headers });
}

export const meta: Route.MetaFunction = () => [
  { title: `${APP_NAME} — Feltételek elfogadása` },
  { name: "robots", content: "noindex" },
];

export default function ConsentRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("core");
  const { upToDate, redirectTo } = loaderData;
  const error = actionData?.ok === false;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <Card>
        <h1
          className="text-2xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {upToDate ? t("consent.upToDateTitle") : t("consent.title")}
        </h1>

        {upToDate ? (
          <>
            <p className="mt-2 text-sm text-text-2">{t("consent.upToDateBody")}</p>
            <Link to="/" className="mt-4 inline-block font-semibold text-petrol underline">
              ← {t("nav.home")}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-text-2">{t("consent.prompt")}</p>
            <p className="mt-2 flex flex-wrap gap-x-3 text-sm">
              <Link to="/aszf" className="font-semibold text-petrol underline">
                {t("consent.termsLink")}
              </Link>
              <Link to="/adatvedelem" className="font-semibold text-petrol underline">
                {t("consent.privacyLink")}
              </Link>
            </p>
            {error ? (
              <p className="mt-3 text-sm font-semibold text-danger-text">{t("consent.error")}</p>
            ) : null}
            <Form method="post" className="mt-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Button type="submit" variant="primary">
                {t("consent.accept")}
              </Button>
            </Form>
          </>
        )}
      </Card>
    </main>
  );
}
