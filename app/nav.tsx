import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation } from "react-router";

import { getLocaleFromPath, localizePath } from "@core/i18n";
// A nav-bejegyzések a modul-manifesztekből jönnek (1.3 modul-szerződés):
// új modul felvételekor ehhez a fájlhoz NEM kell nyúlni.
import { modules } from "@modules/registry";

const primaryNav = modules
  .flatMap((mod) =>
    mod.nav
      .filter((entry) => entry.placement === "primary")
      .map((entry) => ({ ...entry, namespace: mod.i18nNamespace })),
  )
  .sort((a, b) => a.order - b.order);

/** Fejléc-navigáció: brand + a modulok primary nav-bejegyzései a registry-ből. */
export function AppNav() {
  const { t } = useTranslation();
  const locale = getLocaleFromPath(useLocation().pathname);

  return (
    <header className="border-b border-line bg-surface">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4">
        <Link
          to={localizePath("/", locale)}
          className="flex min-h-11 items-center pr-3 font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("home.appName")}
        </Link>
        {primaryNav.map((entry) => (
          <NavLink
            key={`${entry.namespace}:${entry.path}`}
            to={localizePath(entry.path, locale)}
            className={({ isActive }) =>
              `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                isActive
                  ? "text-petrol-text underline underline-offset-4"
                  : "text-text-2 hover:text-petrol-text"
              }`
            }
          >
            {t(entry.labelKey, { ns: entry.namespace })}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
