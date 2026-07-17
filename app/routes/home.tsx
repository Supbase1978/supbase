import { useTranslation } from "react-i18next";

import type { Route } from "./+types/home";

// Meta: az F1.8 SEO-réteg köti át loader-alapú, locale-helyes buildMeta-ra
// (@core/seo) — addig a hu alap-locale szövege áll itt.
export const meta: Route.MetaFunction = () => {
  return [
    { title: "[APPNÉV] — SUP deszkaválasztó, spotok, közösség" },
    {
      name: "description",
      content:
        "Deszkaválasztó, katalógus Népítélettel, SUP-index a magyar vizekre és szolgáltatói directory — egy helyen.",
    },
  ];
};

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
