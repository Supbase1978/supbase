/**
 * /aszf — Általános Szerződési Feltételek (F1.8). Statikus, kétnyelvű jogi oldal
 * (a tartalom az `@core/legal`-ból, locale-helyesen). SEO: loader-alapú meta.
 */
import { APP_NAME } from "@core/brand";
import { getLocaleFromPath } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";
import { termsDocument } from "@core/legal/content";
import { LegalPage } from "@core/legal/LegalPage";

import type { Route } from "./+types/aszf";

export async function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const doc = termsDocument[locale];
  const seo = buildPageSeo({
    request,
    locale,
    path: "/aszf",
    title: `${doc.title} | ${APP_NAME}`,
    description: doc.disclaimer,
  });
  return { locale, seo };
}

export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

export default function TermsRoute({ loaderData }: Route.ComponentProps) {
  return <LegalPage document={termsDocument[loaderData.locale]} />;
}
