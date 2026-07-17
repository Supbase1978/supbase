/**
 * /belepes — belépés e-mail+jelszóval VAGY magic linkkel, Turnstile-lal
 * (4. fejezet 1–2., 4. pont). VÉKONY réteg: minden auth-logika a `@core/auth`-
 * ból jön. Sikertelen belépés → ÁLTALÁNOS üzenet (user-enumeráció kerülése).
 * Progressive enhancement: két submit-gomb (intent=password | magiclink),
 * JS nélkül is működik.
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
import type { Route } from "./+types/belepes";

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
  return {
    redirectTo,
    callbackError: url.searchParams.get("error") === "callback",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "password");
  const email = String(formData.get("email") ?? "").trim();
  const redirectTo = safeRedirect(formData.get("redirectTo"), "/");

  if (!email) {
    return { ok: false as const, errorKey: "auth.errors.emailRequired" };
  }

  const captchaToken = readCaptchaToken(formData);
  if (isTurnstileEnabled() && !captchaToken) {
    return { ok: false as const, errorKey: "auth.errors.captchaRequired" };
  }

  const { supabase, headers } = createSupabaseServerClient(request);

  if (intent === "magiclink") {
    const origin = new URL(request.url).origin;
    const emailRedirectTo = `${origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { captchaToken, emailRedirectTo, shouldCreateUser: true },
    });
    if (error) {
      return { ok: false as const, errorKey: "auth.errors.unexpected" };
    }
    // A PKCE code-verifier a headers Set-Cookie-jában utazik — data()-val adjuk vissza.
    return data({ ok: true as const, magicLinkSent: true }, { headers });
  }

  const password = String(formData.get("password") ?? "");
  if (!password) {
    return { ok: false as const, errorKey: "auth.errors.passwordRequired" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  if (error) {
    // Egységes, általános üzenet — nem áruljuk el, létezik-e a fiók.
    return { ok: false as const, errorKey: "auth.errors.invalidCredentials" };
  }
  throw redirect(redirectTo, { headers });
}

export default function LoginRoute({ loaderData, actionData }: Route.ComponentProps) {
  const t = useAuthT();
  const magicLinkSent = actionData?.ok === true && "magicLinkSent" in actionData;
  const errorKey = actionData && actionData.ok === false ? actionData.errorKey : null;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <Card>
        <h1 className="text-2xl font-semibold text-ink-deep" style={{ fontFamily: "var(--font-display)" }}>
          {t("auth.login.title")}
        </h1>
        <p className="text-sm text-text-2">{t("auth.login.subtitle")}</p>

        {loaderData.callbackError ? (
          <AuthNotice variant="warning">{t("auth.emailConfirm.callbackErrorBody")}</AuthNotice>
        ) : null}

        {magicLinkSent ? (
          <AuthNotice variant="success">{t("auth.login.magicLinkSentBody")}</AuthNotice>
        ) : null}

        {errorKey ? <AuthNotice variant="warning">{t(errorKey)}</AuthNotice> : null}

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
            autoComplete="current-password"
          />

          <Turnstile disabledLabel={t("auth.turnstile.disabledNotice")} />

          <Button type="submit" name="intent" value="password" variant="primary">
            {t("auth.login.submit")}
          </Button>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-text-3">{t("auth.login.magicLinkHint")}</p>
            <Button type="submit" name="intent" value="magiclink" variant="ghost">
              {t("auth.login.magicLinkSubmit")}
            </Button>
          </div>
        </Form>
      </Card>

      <p className="text-center text-sm text-text-2">
        {t("auth.login.noAccount")}{" "}
        <Link to="/regisztracio" className="font-semibold text-petrol underline">
          {t("auth.login.signUpLink")}
        </Link>
      </p>
    </main>
  );
}
