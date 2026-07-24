/**
 * /szolgaltatok/uj — saját szolgáltatás felvétele ("claim/regisztráció", F1.7).
 * Guard: requireUser a loaderben ÉS az actionben (a `providers_insert_own_claim`
 * RLS a védőháló: owner=auth.uid(), a `verified`/`tier` triggerrel biztonságos
 * defaultra kényszerítve). Sikeres beküldés után a profil „Hitelesítés
 * folyamatban” jelöléssel jelenik meg, amíg egy admin jóváhagyja.
 */
import { useTranslation } from "react-i18next";
import { data, Form, redirect } from "react-router";

import { requireUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { Button, Card } from "@core/ui";
import { insertProvider } from "@modules/providers/data/providers.server";
import {
  isProviderServiceType,
  PROVIDER_SERVICE_TYPES,
} from "@modules/providers/types";

import type { Route } from "./+types/szolgaltatok.uj";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

type ActionResult = {
  ok: false;
  errorKey: "new.missingName" | "new.missingType" | "new.error";
};

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const { supabase, headers } = createSupabaseServerClient(request);

  const formData = await request.formData();
  const types = formData
    .getAll("types")
    .map(String)
    .filter(isProviderServiceType);

  const result = await insertProvider(supabase, {
    owner_user_id: user.id,
    name: String(formData.get("name") ?? ""),
    types,
    description_hu: String(formData.get("description") ?? ""),
    contact_email: String(formData.get("email") ?? ""),
    contact_phone: String(formData.get("phone") ?? ""),
    website_url: String(formData.get("website") ?? ""),
  });

  if (result.ok) {
    return redirect(`/szolgaltatok/${result.slug}`, { headers });
  }
  return data<ActionResult>(result, { headers });
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "[APPNÉV] — Regisztráld a szolgáltatásod" }];
};

export default function NewProviderRoute({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation("providers");
  const errorKey = actionData && !actionData.ok ? actionData.errorKey : null;

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("new.title")}
        </h1>
        <p className="text-text-2">{t("new.lead")}</p>
      </header>

      <Card>
        <Form method="post" className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-text">{t("new.name")} *</span>
            <input
              type="text"
              name="name"
              required
              className="min-h-[var(--tap-min)] rounded-[var(--radius-input)] border border-line bg-surface px-3"
            />
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-semibold text-text">{t("new.types")} *</legend>
            <span className="text-xs text-text-3">{t("new.typesHint")}</span>
            <div className="mt-1 flex flex-wrap gap-3">
              {PROVIDER_SERVICE_TYPES.map((type) => (
                <label key={type} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" name="types" value={type} className="size-4" />
                  {t(`type.${type}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-text">{t("new.description")}</span>
            <textarea
              name="description"
              rows={4}
              className="rounded-[var(--radius-input)] border border-line bg-surface p-3"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-text">{t("new.email")}</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              className="min-h-[var(--tap-min)] rounded-[var(--radius-input)] border border-line bg-surface px-3"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-text">{t("new.phone")}</span>
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              className="min-h-[var(--tap-min)] rounded-[var(--radius-input)] border border-line bg-surface px-3"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-text">{t("new.website")}</span>
            <input
              type="url"
              name="website"
              placeholder="https://"
              className="min-h-[var(--tap-min)] rounded-[var(--radius-input)] border border-line bg-surface px-3"
            />
          </label>

          <p className="text-xs text-text-3">{t("new.pendingNotice")}</p>

          {errorKey ? (
            <p className="text-sm font-semibold text-danger-text">{t(errorKey)}</p>
          ) : null}

          <Button type="submit" variant="primary" className="self-start">
            {t("new.submit")}
          </Button>
        </Form>
      </Card>
    </main>
  );
}
