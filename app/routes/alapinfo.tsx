/**
 * /alapinfo — „Alapvető információk" áttekintő: a 4 vízhez (Balaton, Tisza-tó,
 * Duna, Tisza) tartozó SUP-szabály/biztonság/gyakorlati-infó oldalak listája.
 * VÉKONY route: statikus tartalom, nincs DB-lekérdezés (a `WATER_INFO_SLUGS`
 * a spots modulban él, lásd `src/modules/spots/waterinfo.ts`) — ugyanaz a
 * minta, mint a catalog modul `/felszereles` route-ja.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { recordEvent } from "@core/analytics/analytics.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, serverT } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";
import { Card } from "@core/ui";
import { WATER_INFO_SLUGS } from "@modules/spots/waterinfo";

import type { Route } from "./+types/alapinfo";

export async function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);
  await recordEvent(supabase, request, "page_view");

  const t = serverT(locale, "spots");
  const seo = buildPageSeo({
    request,
    locale,
    path: "/alapinfo",
    title: t("waterInfo.seo.list.title"),
    description: t("waterInfo.seo.list.description"),
  });

  return { seo };
}

export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

export default function WaterInfoListRoute() {
  const { t } = useTranslation("spots");

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("waterInfo.list.title")}
        </h1>
        <p className="text-text-2">{t("waterInfo.list.lead")}</p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {WATER_INFO_SLUGS.map((slug) => (
          <li key={slug}>
            <Link to={`/alapinfo/${slug}`} className="block h-full">
              <Card className="h-full transition-shadow hover:shadow-md">
                <h2 className="text-lg font-semibold text-ink-deep">
                  {t(`waterInfo.waters.${slug}.title`)}
                </h2>
                <p className="text-sm text-text-2">{t(`waterInfo.waters.${slug}.tag`)}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
