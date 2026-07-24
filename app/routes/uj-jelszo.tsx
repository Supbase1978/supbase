/**
 * /uj-jelszo — új jelszó beállítása (F1.8b). Ide a jelszó-visszaállító link
 * juttatja a felhasználót, MIUTÁN a `/auth/callback` a PKCE-code-ból recovery-
 * sessiont állított. A guard (requireUser) így aktív sessiont vár; a jelszót a
 * `updateUser` frissíti. Nincs aktív recovery-session → vissza a belépőre.
 */
import { useTranslation } from "react-i18next";
import { data, Form, Link } from "react-router";

import { requireUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { Button, Card } from "@core/ui";

import { AuthField } from "../auth/AuthField";
import { AuthNotice } from "../auth/AuthNotice";
import type { Route } from "./+types/uj-jelszo";

const MIN_PASSWORD_LENGTH = 8;

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false as const, errorKey: "auth.errors.passwordTooShort" };
  }

  const { supabase, headers } = createSupabaseServerClient(request);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false as const, errorKey: "auth.errors.passwordResetFailed" };
  }
  return data({ ok: true as const }, { headers });
}

export const meta: Route.MetaFunction = () => [
  { title: "[APPNÉV] — Új jelszó" },
  { name: "robots", content: "noindex" },
];

export default function NewPasswordRoute({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation("core");
  const success = actionData?.ok === true;
  const errorKey = actionData && actionData.ok === false ? actionData.errorKey : null;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <Card>
        <h1
          className="text-2xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("auth.newPassword.title")}
        </h1>
        <p className="text-sm text-text-2">{t("auth.newPassword.subtitle")}</p>

        {success ? (
          <>
            <AuthNotice variant="success">{t("auth.newPassword.success")}</AuthNotice>
            <Link to="/" className="mt-2 inline-block font-semibold text-petrol underline">
              ← {t("nav.home")}
            </Link>
          </>
        ) : (
          <>
            {errorKey ? <AuthNotice variant="warning">{t(errorKey)}</AuthNotice> : null}
            <Form method="post" className="mt-1 flex flex-col gap-4">
              <AuthField
                id="password"
                name="password"
                type="password"
                label={t("auth.newPassword.passwordLabel")}
                autoComplete="new-password"
                required
              />
              <Button type="submit" variant="primary">
                {t("auth.newPassword.submit")}
              </Button>
            </Form>
          </>
        )}
      </Card>
    </main>
  );
}
