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
    // RÖGZÍTETT fejléc: menüváltáshoz ne kelljen visszagörgetni a lap tetejére.
    // A `bg-surface` átlátszatlan marad, hogy a görgetett tartalom ne üssön át.
    <header className="sticky top-0 z-50 border-b border-line bg-surface">
      {/* Mobilon a nav-elemek nem férnek ki (a modulok száma nő) — a SÁV maga
          görgethető vízszintesen, hogy ne az OLDAL csússzon el. A brand
          `shrink-0`, hogy görgetés közben se torzuljon. */}
      <nav
        aria-label={t("nav.primaryLabel")}
        className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Link
          to={localizePath("/", locale)}
          className="flex min-h-11 shrink-0 items-center pr-3 font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("home.appName")}
        </Link>
        {primaryNav.map((entry) => (
          <NavLink
            key={`${entry.namespace}:${entry.path}`}
            to={localizePath(entry.path, locale)}
            className={({ isActive }) =>
              `flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap ${
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
