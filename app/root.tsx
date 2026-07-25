import { useMemo } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import { getUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { hasMissingRequiredConsents } from "@core/consent/consent.server";
import { createI18n, getLocaleFromPath, stripLocale } from "@core/i18n";
// Modul-namespace-ek regisztrációja (import-mellékhatás) — új modul fordítása
// a src/modules/registry-i18n.ts-ben kötendő be, ehhez a fájlhoz nem kell nyúlni.
import "@modules/registry-i18n";

import type { Route } from "./+types/root";
import { AppNav } from "./nav";
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

export async function loader({ request }: Route.LoaderArgs) {
  // Retroaktív consent-ellenőrzés: csak bejelentkezett usernél megy DB-hez
  // (anon → azonnal false). Egy indexelt lekérdezés; fail-safe false.
  const user = await getUser(request);
  if (!user) {
    return { needsConsent: false };
  }
  const { supabase } = createSupabaseServerClient(request);
  return { needsConsent: await hasMissingRequiredConsents(supabase, user.id) };
}

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

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <>
      {loaderData?.needsConsent ? <ConsentBanner /> : null}
      <AppNav />
      <Outlet />
      <SiteFooter />
    </>
  );
}

/** Lábléc a jogi oldalak site-wide elérhetőségéhez (F1.8). */
function SiteFooter() {
  const { t } = useTranslation("core");
  return (
    <footer className="mt-8 border-t border-line px-4 py-6 text-center text-sm text-text-3">
      <nav
        aria-label={t("nav.footerLabel")}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
      >
        <Link to="/aszf" className="hover:text-petrol-text hover:underline">
          {t("consent.termsLink")}
        </Link>
        <Link to="/adatvedelem" className="hover:text-petrol-text hover:underline">
          {t("consent.privacyLink")}
        </Link>
      </nav>
    </footer>
  );
}

/**
 * Retroaktív re-consent banner (F1.8). Akkor jelenik meg, ha a bejelentkezett
 * usernek hiányzik az aktuális verziójú kötelező beleegyezése — a `/beleegyezes`
 * felületre visz. A consent-oldalon magán NEM jelenik meg (elkerüli a redundanciát).
 * Amber (caution) sáv, sötét felirattal — a `--danger` interakciós elemen tilos.
 */
function ConsentBanner() {
  const { t } = useTranslation("core");
  const path = stripLocale(useLocation().pathname);
  if (path === "/beleegyezes") {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-caution-bg px-4 py-2 text-center text-sm text-caution-text">
      <span>{t("consent.banner")}</span>
      <Link to="/beleegyezes" className="font-bold text-caution-text underline">
        {t("consent.bannerCta")}
      </Link>
    </div>
  );
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
