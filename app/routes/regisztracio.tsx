/**
 * /regisztracio — e-mail+jelszó regisztráció, Turnstile, "megerősítő e-mail
 * elküldve" állapot (4. fejezet 1–2. pont). E-mail-megerősítés KÖTELEZŐ: a
 * signUp után nincs aktív session, a felhasználó a linkkel erősít meg
 * (/auth/callback). User-enumeráció ellen: hiba nélküli signUp mindig a
 * "megerősítő e-mail elküldve" állapotot mutatja.
 */
import { data, Form, Link, redirect } from "react-router";

import {
  isTurnstileEnabled,
  Turnstile,
  TURNSTILE_RESPONSE_FIELD,
} from "@core/auth";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getUser, safeRedirect } from "@core/auth/session.server";
import { Button, Card } from "@core/ui";

import { AuthField } from "../auth/AuthField";
import { AuthNotice } from "../auth/AuthNotice";
import { useAuthT } from "../auth/auth-i18n";
import type { Route } from "./+types/regisztracio";

function readCaptchaToken(formData: FormData): string | undefined {
  if (!isTurnstileEnabled()) {
    return undefined;
  }
  const token = formData.get(TURNSTILE_RESPONSE_FIELD);
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "/");
  const user = await getUser(request);
  if (user) {
    throw redirect(redirectTo);
  }
  return { redirectTo };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirect(formData.get("redirectTo"), "/");

  if (!email) {
    return { ok: false as const, errorKey: "auth.errors.emailRequired" };
  }
  if (!password) {
    return { ok: false as const, errorKey: "auth.errors.passwordRequired" };
  }

  const captchaToken = readCaptchaToken(formData);
  if (isTurnstileEnabled() && !captchaToken) {
    return { ok: false as const, errorKey: "auth.errors.captchaRequired" };
  }

  const { supabase, headers } = createSupabaseServerClient(request);
  const origin = new URL(request.url).origin;
  const emailRedirectTo = `${origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { captchaToken, emailRedirectTo },
  });
  if (error) {
    return { ok: false as const, errorKey: "auth.errors.unexpected" };
  }
  // Sikeres signUp → mindig "megerősítő e-mail elküldve" (létező cím sem derül ki).
  return data({ ok: true as const, confirmationSent: true }, { headers });
}

export default function SignupRoute({ loaderData, actionData }: Route.ComponentProps) {
  const t = useAuthT();
  const confirmationSent = actionData?.ok === true;
  const errorKey = actionData && actionData.ok === false ? actionData.errorKey : null;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <Card>
        <h1 className="text-2xl font-semibold text-ink-deep" style={{ fontFamily: "var(--font-display)" }}>
          {t("auth.signup.title")}
        </h1>
        <p className="text-sm text-text-2">{t("auth.signup.subtitle")}</p>

        {confirmationSent ? (
          <AuthNotice variant="success">
            <span className="block font-semibold">{t("auth.signup.confirmationSentTitle")}</span>
            {t("auth.signup.confirmationSentBody")}
          </AuthNotice>
        ) : null}

        {errorKey ? <AuthNotice variant="warning">{t(errorKey)}</AuthNotice> : null}

        {!confirmationSent ? (
          <Form method="post" className="mt-1 flex flex-col gap-4">
            <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
            <AuthField
              id="email"
              name="email"
              type="email"
              label={t("auth.common.emailLabel")}
              placeholder={t("auth.common.emailPlaceholder")}
              autoComplete="email"
              required
            />
            <AuthField
              id="password"
              name="password"
              type="password"
              label={t("auth.common.passwordLabel")}
              autoComplete="new-password"
              required
            />

            <Turnstile disabledLabel={t("auth.turnstile.disabledNotice")} />

            <Button type="submit" variant="primary">
              {t("auth.signup.submit")}
            </Button>
          </Form>
        ) : null}
      </Card>

      <p className="text-center text-sm text-text-2">
        {t("auth.signup.haveAccount")}{" "}
        <Link to="/belepes" className="font-semibold text-petrol underline">
          {t("auth.signup.loginLink")}
        </Link>
      </p>
    </main>
  );
}
