/**
 * i18next-inicializálás (FEJLESZTESI_DOKUMENTACIO 8. fejezet).
 *
 * `createI18n(locale)` egy ÚJ i18next-példányt gyárt kérésenként — ez teszi
 * SSR-kompatibilissé (nincs megosztott, kérések között szivárgó globális
 * állapot a szerveren). Statikus resource-importokból dolgozik, http-backend
 * nincs. A resource-fa (namespace-enkénti fordítások) a `resources.ts`
 * regiszteréből épül fel; új namespace a `registerNamespace` hívással
 * kapcsolódik be (modulonként, a modul `module.ts`-éből).
 */
import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";

import { defaultLocale, locales, type Locale } from "./config";
import { buildResourceBundle, getRegisteredNamespaces } from "./resources";

export { defaultLocale, locales, isLocale, type Locale } from "./config";
export { registerNamespace, type NamespaceResources } from "./resources";
export {
  getLocaleFromPath,
  localizePath,
  stripLocale,
} from "./url";
export { pickTranslated } from "./translated";

const CORE_NAMESPACE = "core";

/** Új i18next-példány létrehozása és inicializálása egy adott locale-hoz. */
export function createI18n(locale: Locale): i18n {
  const instance = i18next.createInstance();

  void instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: defaultLocale,
    supportedLngs: locales as unknown as string[],
    defaultNS: CORE_NAMESPACE,
    ns: getRegisteredNamespaces(),
    resources: buildResourceBundle(),
    interpolation: { escapeValue: false },
    returnNull: false,
    // Szinkron init bundle-ezett resources mellett (nincs setTimeout-tal
    // elhalasztott betöltés) — SSR-en fontos, hogy .init() után rögtön
    // hívható legyen instance.t(...).
    initAsync: false,
  });

  return instance;
}
