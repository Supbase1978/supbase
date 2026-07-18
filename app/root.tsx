import { useMemo } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import { createI18n, getLocaleFromPath } from "@core/i18n";
// Modul-namespace-ek regisztrációja (import-mellékhatás) — új modul fordítása
// a src/modules/registry-i18n.ts-ben kötendő be, ehhez a fájlhoz nem kell nyúlni.
import "@modules/registry-i18n";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700&family=Instrument+Sans:wght@400;500;600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // Locale az URL-ből (8. + 6. fejezet: hu default prefix nélkül, en: /en/...).
  // Az i18next-példány kérésenként/locale-onként új (SSR-biztos), a provider a
  // Layoutban ül, így az ErrorBoundary is fordított szöveget kap.
  const locale = getLocaleFromPath(useLocation().pathname);
  const i18n = useMemo(() => createI18n(locale), [locale]);

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation("core");
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  const title = notFound ? t("errors.notFound.title") : t("errors.generic.title");
  let details = notFound
    ? t("errors.notFound.message")
    : t("errors.generic.message");

  if (!notFound && import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="p-8" style={{ fontFamily: "var(--font-body)" }}>
      <h1
        className="text-2xl font-semibold text-ink-deep"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h1>
      <p className="mt-2 text-text-2">{details}</p>
    </main>
  );
}
