import { useTranslation } from "react-i18next";

import { getLocaleFromPath, serverT } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";

import type { Route } from "./+types/home";

export async function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const t = serverT(locale, "core");
  return {
    seo: buildPageSeo({
      request,
      locale,
      path: "/",
      title: t("seo.home.title"),
      description: t("seo.home.description"),
    }),
  };
}

// Locale-helyes SEO-meta a loaderből (F1.8): title/description/OG + canonical + hreflang.
export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

export default function Home() {
  const { t } = useTranslation("core");

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-4 p-8">
      <p className="text-sm text-text-3">{t("home.phase")}</p>
      <h1
        className="text-4xl font-semibold text-ink-deep"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("home.appName")}
      </h1>
      <p className="text-text-2">{t("home.tagline")}</p>
    </main>
  );
}
