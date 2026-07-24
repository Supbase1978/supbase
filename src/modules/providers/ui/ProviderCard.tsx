/**
 * Szolgáltató-kártya a listához (`/szolgaltatok`). Név + szolgáltatás-fajta-
 * chipek + (opcionális) „Kiemelt”/„Hitelesített” jelvény + rövid leírás. A
 * `@core/ui Card`-ra épül; a link a profilra visz. A „Hitelesített” jelvény a
 * biztonsági `StatusBadge` (safe: szín+ikon+szöveg) — a „Kiemelt” semleges chip
 * (nem státusz-szemantika, ezért NEM StatusBadge).
 */
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Card, StatusBadge } from "@core/ui";

import type { ProviderServiceType } from "../types";

export interface ProviderCardData {
  id: string;
  slug: string;
  name: string;
  types: ProviderServiceType[];
  description: string | null;
  premium: boolean;
  verified: boolean;
}

export interface ProviderCardProps {
  provider: ProviderCardData;
  className?: string;
}

export function ProviderCard({ provider, className }: ProviderCardProps) {
  const { t } = useTranslation("providers");

  return (
    <Card className={className}>
      <Link to={`/szolgaltatok/${provider.slug}`} className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-lg font-semibold text-ink-deep">{provider.name}</span>
          {provider.premium ? (
            <span className="shrink-0 rounded-full bg-caution-bg px-2.5 py-1 text-xs font-bold text-caution-text">
              {t("tier.premium")}
            </span>
          ) : null}
        </div>

        {provider.verified ? (
          <StatusBadge status="safe" label={t("verified.badge")} className="self-start" />
        ) : (
          <span className="self-start rounded-full border border-line bg-mist px-3 py-1 text-xs font-semibold text-stale">
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
          <p className="line-clamp-2 text-sm text-text-2">{provider.description}</p>
        ) : null}
      </Link>
    </Card>
  );
}
