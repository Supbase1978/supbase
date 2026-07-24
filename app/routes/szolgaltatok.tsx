/**
 * /szolgaltatok — szolgáltatói directory-lista (F1.7). VÉKONY loader: publikus
 * providers-olvasás (RLS: `providers_public_read`), locale-helyes slug/leírás.
 * A komponens: típus-szűrőchipek + ProviderCard-rács (a providers-modul UI-jából).
 * A „claim/regisztráció” CTA a `/szolgaltatok/uj` (requireUser) route-ra visz.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, pickTranslated } from "@core/i18n";
import { cx } from "@core/ui";
import { listProviders } from "@modules/providers/data/providers.server";
import { ProviderCard, type ProviderCardData } from "@modules/providers/ui/ProviderCard";
import { PROVIDER_SERVICE_TYPES, type ProviderServiceType } from "@modules/providers/types";

import type { Route } from "./+types/szolgaltatok";

export async function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);

  const providers = await listProviders(supabase);

  const items: ProviderCardData[] = providers.map((provider) => ({
    id: provider.id,
    slug: pickTranslated(provider.slug, locale),
    name: provider.name,
    types: provider.type,
    description: pickTranslated(provider.description, locale) || null,
    premium: provider.tier === "premium",
    verified: provider.verified,
  }));

  return { items };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "[APPNÉV] — Szolgáltatók" }];
};

export default function ProvidersListRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("providers");
  const { items } = loaderData;

  // Kliens-oldali típus-szűrő: null = mind. A type[] BÁRMELY eleme egyezhet.
  const [filter, setFilter] = useState<ProviderServiceType | null>(null);
  const visible = filter ? items.filter((item) => item.types.includes(filter)) : items;

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1
            className="text-3xl font-semibold text-ink-deep"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("list.title")}
          </h1>
          <Link
            to="/szolgaltatok/uj"
            className="inline-flex min-h-[var(--tap-min)] items-center rounded-full bg-ink-deep px-4 text-sm font-semibold text-surface transition-colors hover:bg-petrol"
          >
            {t("list.addOwn")}
          </Link>
        </div>
        <p className="text-text-2">{t("list.lead")}</p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("list.title")}>
        <FilterChip active={filter === null} label={t("list.title")} onClick={() => setFilter(null)} />
        {PROVIDER_SERVICE_TYPES.map((type) => (
          <FilterChip
            key={type}
            active={filter === type}
            label={t(`type.${type}`)}
            onClick={() => setFilter((prev) => (prev === type ? null : type))}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-text-2">{t("list.empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.id}>
              <ProviderCard provider={item} className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "min-h-[var(--tap-min)] rounded-full border px-4 text-sm font-semibold transition-colors",
        active
          ? "border-ink-deep bg-ink-deep text-surface"
          : "border-line bg-surface text-text-2 hover:text-petrol-text",
      )}
    >
      {label}
    </button>
  );
}
