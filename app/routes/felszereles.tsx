/**
 * /felszereles — kiegészítő-kategóriák áttekintője (F2.3 1. szakasz). VÉKONY
 * route: statikus tartalom, nincs DB-lekérdezés (a `GEAR_CATEGORIES` a catalog
 * modulban él, lásd `src/modules/catalog/gear.ts`). A termékszintű katalógus
 * (kind='accessory') a terv 2. szakasza — ide (még) nem nyúlunk.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { recordEvent } from "@core/analytics/analytics.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, serverT } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";
import { Card } from "@core/ui";
import { GEAR_CATEGORIES } from "@modules/catalog/gear";

import type { Route } from "./+types/felszereles";

export async function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);
  await recordEvent(supabase, request, "page_view");

  const t = serverT(locale, "catalog");
  const seo = buildPageSeo({
    request,
    locale,
    path: "/felszereles",
    title: t("gear.seo.list.title"),
    description: t("gear.seo.list.description"),
  });

  return { seo };
}

export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

export default function GearListRoute() {
  const { t } = useTranslation("catalog");

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("gear.list.title")}
        </h1>
        <p className="text-text-2">{t("gear.list.lead")}</p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GEAR_CATEGORIES.map((category) => (
          <li key={category}>
            <Link to={`/felszereles/${category}`} className="block h-full">
              <Card className="h-full transition-shadow hover:shadow-md">
                <h2 className="text-lg font-semibold text-ink-deep">
                  {t(`gear.categories.${category}.title`)}
                </h2>
                <p className="text-sm text-text-2">{t(`gear.categories.${category}.short`)}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
