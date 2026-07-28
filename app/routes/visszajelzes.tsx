/**
 * /visszajelzes — visszajelzés a fejlesztőnek (F2.2).
 *
 * Hibajelentés, hiányzó BOLT vagy DESZKA-MODELL javaslata. A tartalom NEM
 * publikus: a `feedback` tábla RLS-e szerint olvasni csak admin tud, ez az
 * oldal csak beküldeni enged.
 *
 * MIÉRT KELL BEJELENTKEZÉS: a hitelesítés nélküli visszajelzés-végpont
 * levélbombázható és szemét-özönnel eltömíthető (ez a hiba egy testvér-
 * projektben élesben elő is fordult). A projekt vélemény- és jelentés-
 * folyamatai is e-mail-gate-eltek — ugyanaz a minta.
 *
 * A `?tema=` és `?ut=` query-paraméterrel a kontextusból érkező linkek
 * előválasztják a témát és az érintett oldalt (pl. „Hiányzik egy modell?").
 */
import { useTranslation } from "react-i18next";
import { data, Form, Link, useSearchParams } from "react-router";

import { isEmailConfirmed } from "@core/auth/email-confirmed";
import { requireUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { APP_NAME } from "@core/brand";
import {
  FEEDBACK_KINDS,
  MESSAGE_MIN_LENGTH,
  isFeedbackKind,
  sanitizePagePath,
  submitFeedback,
} from "@core/feedback/feedback.server";
import { notifyFeedback } from "@core/feedback/notify.server";
import { Button, Card } from "@core/ui";

import type { Route } from "./+types/visszajelzes";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { emailConfirmed: isEmailConfirmed(user) };
}

type ActionResult = { ok: boolean; errorKey?: string };

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { supabase, headers } = createSupabaseServerClient(request);

  if (!isEmailConfirmed(user)) {
    return data<ActionResult>({ ok: false, errorKey: "feedback.confirmRequired" }, { headers });
  }

  const formData = await request.formData();
  const kind = String(formData.get("kind") ?? "");
  const message = String(formData.get("message") ?? "");
  const pagePath = sanitizePagePath(String(formData.get("pagePath") ?? ""));

  const result = await submitFeedback(supabase, {
    // A beküldő a HITELESÍTETT sessionből jön, sosem az űrlapról.
    userId: user.id,
    kind,
    message,
    pagePath,
  });

  // E-mail-értesítés BEST-EFFORT: az elsődleges tároló az adatbázis, ezért a
  // levél hibája nem befolyásolja a felhasználónak adott választ. Resend-kulcs
  // nélkül (élesítési checklist) csendben kimarad.
  if (result.ok && isFeedbackKind(kind)) {
    await notifyFeedback({ kind, message: message.trim(), pagePath });
  }

  return data<ActionResult>(
    result.ok ? { ok: true } : { ok: false, errorKey: `feedback.error.${result.errorKey}` },
    { headers },
  );
}

export const meta: Route.MetaFunction = () => {
  // Bejelentkezés mögötti űrlap: nincs SEO-értéke, a robots.txt is tiltja.
  return [{ title: `${APP_NAME} — Visszajelzés` }, { name: "robots", content: "noindex" }];
};

export default function FeedbackRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("core");
  const [searchParams] = useSearchParams();

  const presetKindParam = searchParams.get("tema") ?? "";
  const presetKind = isFeedbackKind(presetKindParam) ? presetKindParam : "bug";
  const presetPath = sanitizePagePath(searchParams.get("ut")) ?? "";

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <h1
        className="text-3xl font-semibold text-ink-deep"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("feedback.title")}
      </h1>
      <p className="text-sm text-text-2">{t("feedback.lead")}</p>

      {!loaderData.emailConfirmed ? (
        <Card>
          <p className="text-sm text-text-2">{t("feedback.confirmRequired")}</p>
        </Card>
      ) : actionData?.ok ? (
        <Card>
          <p className="text-sm font-semibold text-text">{t("feedback.thanks")}</p>
          <p className="mt-2 text-sm">
            <Link to="/" className="text-petrol underline">
              {t("nav.home")}
            </Link>
          </p>
        </Card>
      ) : (
        <Card>
          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="pagePath" value={presetPath} />

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-text">{t("feedback.kindLabel")}</legend>
              {FEEDBACK_KINDS.map((kind) => (
                <label key={kind} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="radio"
                    name="kind"
                    value={kind}
                    defaultChecked={kind === presetKind}
                    required
                  />
                  {t(`feedback.kind.${kind}`)}
                </label>
              ))}
            </fieldset>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">{t("feedback.messageLabel")}</span>
              <textarea
                name="message"
                required
                minLength={MESSAGE_MIN_LENGTH}
                maxLength={4000}
                rows={6}
                placeholder={t("feedback.messagePlaceholder")}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text"
              />
              <span className="text-xs text-text-3">
                {t("feedback.messageHint", { min: MESSAGE_MIN_LENGTH })}
              </span>
            </label>

            {actionData?.errorKey ? (
              <p className="text-sm text-caution-text">{t(actionData.errorKey)}</p>
            ) : null}

            <div>
              <Button type="submit" variant="primary">
                {t("feedback.submit")}
              </Button>
            </div>
          </Form>
        </Card>
      )}
    </main>
  );
}
