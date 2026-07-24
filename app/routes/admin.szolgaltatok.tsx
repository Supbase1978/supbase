/**
 * /admin/szolgaltatok — szolgáltató-hitelesítés (F1.7 admin-jóváhagyás). Guard:
 * requireRole('admin') a loaderben ÉS az actionben — a `verified` jelvényt a
 * `protect_provider_columns` trigger KIZÁRÓLAG adminnak engedi állítani (a
 * moderátor verify-ja némán no-op lenne), így itt admin-jog kell. Az RLS
 * (`providers_update_admin`) a védőháló.
 */
import { useTranslation } from "react-i18next";
import { data, Form } from "react-router";

import { requireRole } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { Button, Card, StatusBadge } from "@core/ui";
import {
  listProvidersByVerified,
  setProviderVerified,
} from "@modules/providers/data/providers.server";
import type { ProviderServiceType } from "@modules/providers/types";

import type { Route } from "./+types/admin.szolgaltatok";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const { supabase } = createSupabaseServerClient(request);

  const [pending, verified] = await Promise.all([
    listProvidersByVerified(supabase, false),
    listProvidersByVerified(supabase, true),
  ]);

  const toItem = (p: (typeof pending)[number]) => ({
    id: p.id,
    name: p.name,
    types: p.type as ProviderServiceType[],
    owned: p.owner_user_id !== null,
    verified: p.verified,
  });

  return { pending: pending.map(toItem), verified: verified.map(toItem) };
}

type ActionResult = { ok: boolean };

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const { supabase, headers } = createSupabaseServerClient(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const providerId = String(formData.get("providerId") ?? "");

  let result: { ok: boolean } = { ok: false };
  if (intent === "verify") {
    result = await setProviderVerified(supabase, providerId, true);
  } else if (intent === "unverify") {
    result = await setProviderVerified(supabase, providerId, false);
  }

  return data<ActionResult>(result, { headers });
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "[APPNÉV] — Szolgáltató-hitelesítés" }];
};

export default function AdminProvidersRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("providers");
  const { pending, verified } = loaderData;

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <h1
        className="text-3xl font-semibold text-ink-deep"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("admin.title")}
      </h1>

      {/* Hitelesítésre vár */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink-deep">{t("admin.pending")}</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-text-2">{t("admin.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((provider) => (
              <li key={provider.id}>
                <ProviderModCard provider={provider} intent="verify" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Hitelesített szolgáltatók */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink-deep">{t("admin.verifiedList")}</h2>
        {verified.length === 0 ? (
          <p className="text-sm text-text-2">{t("admin.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {verified.map((provider) => (
              <li key={provider.id}>
                <ProviderModCard provider={provider} intent="unverify" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ProviderModCard({
  provider,
  intent,
}: {
  provider: {
    id: string;
    name: string;
    types: ProviderServiceType[];
    owned: boolean;
    verified: boolean;
  };
  intent: "verify" | "unverify";
}) {
  const { t } = useTranslation("providers");

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-text">{provider.name}</span>
        {provider.verified ? (
          <StatusBadge status="safe" label={t("verified.badge")} />
        ) : (
          <span className="rounded-full border border-line bg-mist px-3 py-1 text-xs font-semibold text-stale">
            {t("status.unverifiedBadge")}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {provider.types.map((type) => (
          <span
            key={type}
            className="rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-text-2"
          >
            {t(`type.${type}`)}
          </span>
        ))}
        <span className="ml-1 text-xs text-text-3">
          {provider.owned ? t("admin.owned") : t("admin.unowned")}
        </span>
      </div>
      <div className="mt-3">
        <Form method="post">
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="providerId" value={provider.id} />
          <Button type="submit" variant="secondary">
            {intent === "verify" ? t("admin.verify") : t("admin.unverify")}
          </Button>
        </Form>
      </div>
    </Card>
  );
}
