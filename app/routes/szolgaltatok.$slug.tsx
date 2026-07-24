/**
 * /szolgaltatok/:slug — szolgáltató-profil (F1.7). A providers (adat) és a spots
 * (kötött helyszínek) összekötése KIZÁRÓLAG itt, a route-rétegben történik (1.3
 * modul-szerződés: a providers nem importál spots-t). A profil: fejléc +
 * hitelesített/kiemelt jelvény + elérhetőség + kapcsolódó spotok + lead-form
 * (érdeklődés — anon is küldhet, e-mail kötelező; insert-gate az RLS-en).
 */
import { useTranslation } from "react-i18next";
import { data, Form, Link } from "react-router";

import { getUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, pickTranslated } from "@core/i18n";
import { Button, Card, StatusBadge } from "@core/ui";
import {
  getProviderBySlug,
  insertLead,
  listLinkedSpots,
  safeExternalUrl,
} from "@modules/providers/data/providers.server";
import type { ProviderServiceType } from "@modules/providers/types";

import type { Route } from "./+types/szolgaltatok.$slug";

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);

  const provider = await getProviderBySlug(supabase, slug);
  if (!provider) {
    throw new Response("Not Found", { status: 404 });
  }

  const [linked, user] = await Promise.all([
    listLinkedSpots(supabase, provider.id),
    getUser(request),
  ]);

  return {
    provider: {
      id: provider.id,
      name: provider.name,
      types: provider.type as ProviderServiceType[],
      description: pickTranslated(provider.description, locale) || null,
      contactEmail: provider.contact_email,
      contactPhone: provider.contact_phone,
      websiteUrl: safeExternalUrl(provider.website_url),
      premium: provider.tier === "premium",
      verified: provider.verified,
    },
    linkedSpots: linked.map((spot) => ({
      id: spot.spotId,
      name: spot.name,
      slug: pickTranslated(spot.slug, locale),
    })),
    lead: {
      isLoggedIn: Boolean(user),
      prefillEmail: user?.email ?? "",
    },
  };
}

type ActionResult =
  | { ok: true }
  | { ok: false; errorKey: "lead.invalidEmail" | "lead.error" };

export async function action({ request, params }: Route.ActionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const { supabase, headers } = createSupabaseServerClient(request);
  const provider = await getProviderBySlug(supabase, slug);
  if (!provider) {
    throw new Response("Not Found", { status: 404 });
  }

  const user = await getUser(request);
  const formData = await request.formData();

  const result = await insertLead(supabase, {
    provider_id: provider.id,
    user_id: user?.id ?? null,
    name: trimmedOrNull(formData.get("name")),
    email: String(formData.get("email") ?? ""),
    message: trimmedOrNull(formData.get("message")),
  });

  return data<ActionResult>(result, { headers });
}

export const meta: Route.MetaFunction = ({ data: loaderData }) => {
  const name = loaderData?.provider.name ?? "Szolgáltató";
  return [{ title: `[APPNÉV] — ${name}` }];
};

export default function ProviderProfileRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("providers");
  const { provider, linkedSpots, lead } = loaderData;

  const leadSubmitted = actionData?.ok === true;
  const leadError = actionData && !actionData.ok ? actionData.errorKey : null;

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <Link to="/szolgaltatok" className="text-sm font-semibold text-petrol-text hover:underline">
        ← {t("profile.backToList")}
      </Link>

      {/* Fejléc */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1
            className="text-3xl font-semibold text-ink-deep"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {provider.name}
          </h1>
          {provider.premium ? (
            <span className="shrink-0 rounded-full bg-caution-bg px-3 py-1.5 text-xs font-bold text-caution-text">
              {t("tier.premium")}
            </span>
          ) : null}
        </div>

        {provider.verified ? (
          <StatusBadge status="safe" label={t("verified.badge")} className="self-start" />
        ) : (
          <span className="self-start rounded-full border border-line bg-mist px-3 py-1.5 text-xs font-semibold text-stale">
            {t("status.unverifiedBadge")}
          </span>
        )}

        <div className="flex flex-wrap gap-1.5">
          {provider.types.map((type) => (
            <span
              key={type}
              className="rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-text-2"
            >
              {t(`type.${type}`)}
            </span>
          ))}
        </div>

        {provider.description ? (
          <p className="text-text-2">{provider.description}</p>
        ) : null}
      </header>

      {/* Elérhetőség */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink-deep">{t("profile.contact")}</h2>
        {provider.contactEmail || provider.contactPhone || provider.websiteUrl ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {provider.contactEmail ? (
              <>
                <dt className="text-text-3">{t("profile.email")}:</dt>
                <dd>
                  <a className="text-petrol-text hover:underline" href={`mailto:${provider.contactEmail}`}>
                    {provider.contactEmail}
                  </a>
                </dd>
              </>
            ) : null}
            {provider.contactPhone ? (
              <>
                <dt className="text-text-3">{t("profile.phone")}:</dt>
                <dd>
                  <a className="text-petrol-text hover:underline" href={`tel:${provider.contactPhone}`}>
                    {provider.contactPhone}
                  </a>
                </dd>
              </>
            ) : null}
            {provider.websiteUrl ? (
              <>
                <dt className="text-text-3">{t("profile.website")}:</dt>
                <dd>
                  <a
                    className="text-petrol-text hover:underline"
                    href={provider.websiteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {provider.websiteUrl}
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-text-2">{t("profile.noContact")}</p>
        )}
      </section>

      {/* Kapcsolódó spotok */}
      {linkedSpots.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-ink-deep">{t("profile.linkedSpots")}</h2>
          <ul className="flex flex-wrap gap-2">
            {linkedSpots.map((spot) => (
              <li key={spot.id}>
                <Link
                  to={`/spotok/${spot.slug}`}
                  className="inline-flex rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-petrol-text hover:bg-mist"
                >
                  {spot.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Lead-form (érdeklődés) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink-deep">{t("lead.title")}</h2>
        {leadSubmitted ? (
          <Card>
            <p className="text-sm font-semibold text-safe-text">{t("lead.success")}</p>
          </Card>
        ) : (
          <Card>
            <p className="mb-3 text-sm text-text-2">{t("lead.lead")}</p>
            <Form method="post" className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-text">{t("lead.name")}</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  className="min-h-[var(--tap-min)] rounded-[var(--radius-input)] border border-line bg-surface px-3"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-text">{t("lead.email")} *</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  defaultValue={lead.prefillEmail}
                  className="min-h-[var(--tap-min)] rounded-[var(--radius-input)] border border-line bg-surface px-3"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-text">{t("lead.message")}</span>
                <textarea
                  name="message"
                  rows={4}
                  className="rounded-[var(--radius-input)] border border-line bg-surface p-3"
                />
              </label>
              {leadError ? (
                <p className="text-sm font-semibold text-danger-text">{t(leadError)}</p>
              ) : null}
              <Button type="submit" variant="primary" className="self-start">
                {t("lead.submit")}
              </Button>
            </Form>
          </Card>
        )}
      </section>
    </main>
  );
}
