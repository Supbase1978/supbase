/**
 * /elfelejtett-jelszo — jelszó-visszaállító link kérése (F1.8b). A Supabase
 * `resetPasswordForEmail` küld egy PKCE-linket, amely a MEGLÉVŐ `/auth/callback`-en
 * át állít recovery-sessiont, majd a `/uj-jelszo` oldalra visz. User-enumeráció
 * ellen: mindig a „link elküldve" állapotot mutatjuk. Turnstile a visszaélés ellen.
 */
import { data, Form, Link, redirect } from "react-router";

import { APP_NAME } from "@core/brand";
import { isTurnstileEnabled, Turnstile, TURNSTILE_RESPONSE_FIELD } from "@core/auth";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getUser } from "@core/auth/session.server";
import { Button, Card } from "@core/ui";

import { AuthField } from "../auth/AuthField";
import { AuthNotice } from "../auth/AuthNotice";
import { useAuthT } from "../auth/auth-i18n";
import type { Route } from "./+types/elfelejtett-jelszo";

function readCaptchaToken(formData: FormData): string | undefined {
  if (!isTurnstileEnabled()) {
    return undefined;
  }
  const token = formData.get(TURNSTILE_RESPONSE_FIELD);
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (user) {
    throw redirect("/");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { ok: false as const, errorKey: "auth.errors.emailRequired" };
  }
  const captchaToken = readCaptchaToken(formData);
  if (isTurnstileEnabled() && !captchaToken) {
    return { ok: false as const, errorKey: "auth.errors.captchaRequired" };
  }

  const { supabase, headers } = createSupabaseServerClient(request);
  const origin = new URL(request.url).origin;
  const redirectTo = `${origin}/auth/callback?redirectTo=${encodeURIComponent("/uj-jelszo")}`;

  // Hibát NEM szivárogtatunk (user-enumeráció) — mindig „elküldve".
  await supabase.auth.resetPasswordForEmail(email, { captchaToken, redirectTo });
  return data({ ok: true as const, sent: true }, { headers });
}

export const meta: Route.MetaFunction = () => [
  { title: `${APP_NAME} — Elfelejtett jelszó` },
  { name: "robots", content: "noindex" },
];

export default function ForgotPasswordRoute({ actionData }: Route.ComponentProps) {
  const t = useAuthT();
  const sent = actionData?.ok === true;
  const errorKey = actionData && actionData.ok === false ? actionData.errorKey : null;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <Card>
        <h1
          className="text-2xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("auth.forgotPassword.title")}
        </h1>
        <p className="text-sm text-text-2">{t("auth.forgotPassword.subtitle")}</p>

        {sent ? (
          <AuthNotice variant="success">
            <span className="block font-semibold">{t("auth.forgotPassword.sentTitle")}</span>
            {t("auth.forgotPassword.sentBody")}
          </AuthNotice>
        ) : null}

        {errorKey ? <AuthNotice variant="warning">{t(errorKey)}</AuthNotice> : null}

        {!sent ? (
          <Form method="post" className="mt-1 flex flex-col gap-4">
            <AuthField
              id="email"
              name="email"
              type="email"
              label={t("auth.common.emailLabel")}
              placeholder={t("auth.common.emailPlaceholder")}
              autoComplete="email"
              required
            />
            <Turnstile disabledLabel={t("auth.turnstile.disabledNotice")} />
            <Button type="submit" variant="primary">
              {t("auth.forgotPassword.submit")}
            </Button>
          </Form>
        ) : null}
      </Card>

      <p className="text-center text-sm text-text-2">
        <Link to="/belepes" className="font-semibold text-petrol underline">
          {t("auth.forgotPassword.backToLogin")}
        </Link>
      </p>
    </main>
  );
}
