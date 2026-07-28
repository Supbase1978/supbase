/**
 * /admin/analitika — süti-mentes használati statisztika (12/6, F1.12).
 *
 * Guard: `requireRole('admin')`. Az adat az `analytics_daily` nézetből jön,
 * amely `security_invoker`-rel olvas — tehát az alaptábla admin-only RLS-e a
 * tényleges védelem, nem ez a route (az csak a felület).
 *
 * A lap SZÁNDÉKOSAN sivár: számok és arányok, grafikon nélkül. Egy diagram
 * itt díszítés lenne — a kérdés („elindítják-e a deszkaválasztót, és eljutnak-e
 * eredményig") egyetlen aránnyal megválaszolható.
 */
import { useTranslation } from "react-i18next";

import { listDailyCounts, summarize } from "@core/analytics/analytics-query.server";
import { requireRole } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { APP_NAME } from "@core/brand";
import { Card } from "@core/ui";

import type { Route } from "./+types/admin.analitika";

const RANGE_DAYS = 30;

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const { supabase } = createSupabaseServerClient(request);
  const rows = await listDailyCounts(supabase, RANGE_DAYS);
  return { summary: summarize(rows), rangeDays: RANGE_DAYS };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: `${APP_NAME} — Használati statisztika` }, { name: "robots", content: "noindex" }];
};

export default function AdminAnalyticsRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("core");
  const { summary, rangeDays } = loaderData;

  const conversion =
    summary.advisorConversion === null
      ? "—"
      : `${Math.round(summary.advisorConversion * 100)}%`;

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("analytics.title")}
        </h1>
        <p className="text-sm text-text-2">{t("analytics.range", { days: rangeDays })}</p>
        <p className="text-xs text-text-3">{t("analytics.privacyNote")}</p>
      </header>

      <Card>
        <h2 className="text-lg font-bold text-ink-deep">{t("analytics.funnel")}</h2>
        <p className="mt-1 text-3xl font-bold text-petrol-text">{conversion}</p>
        <p className="mt-1 text-sm text-text-2">{t("analytics.funnelHint")}</p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-ink-deep">{t("analytics.totals")}</h2>
        {summary.totals.length === 0 ? (
          <p className="mt-2 text-sm text-text-2">{t("analytics.empty")}</p>
        ) : (
          <dl className="mt-2 flex flex-col gap-1 text-sm">
            {summary.totals.map((row) => (
              <div key={row.name} className="flex items-baseline justify-between gap-4">
                <dt className="text-text-2">{t(`analytics.event.${row.name}`)}</dt>
                <dd className="font-bold text-ink-deep tabular-nums">{row.events}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {summary.days.length > 0 ? (
        <Card>
          <h2 className="text-lg font-bold text-ink-deep">{t("analytics.daily")}</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-3">
                  <th className="py-1 pr-4 font-semibold">{t("analytics.day")}</th>
                  <th className="py-1 pr-4 text-right font-semibold">{t("analytics.total")}</th>
                  {summary.totals.map((row) => (
                    <th key={row.name} className="py-1 pr-4 text-right font-semibold">
                      {t(`analytics.event.${row.name}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.days.map((day) => (
                  <tr key={day.day} className="border-t border-line">
                    <td className="py-1 pr-4 whitespace-nowrap text-text-2">{day.day}</td>
                    <td className="py-1 pr-4 text-right font-semibold tabular-nums text-ink-deep">
                      {day.total}
                    </td>
                    {summary.totals.map((row) => (
                      <td key={row.name} className="py-1 pr-4 text-right tabular-nums text-text-2">
                        {day.byName[row.name] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </main>
  );
}
