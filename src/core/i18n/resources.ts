/**
 * Namespace-regiszter az i18next resource-fához.
 *
 * A `core` namespace-t ez a fájl regisztrálja be alapból (statikus JSON-
 * importokkal, http-backend nélkül — SSR- és bundler-barát). A modulok
 * (advisor, spots, …) a saját `module.ts` manifesztjükből, betöltéskor
 * hívják meg a `registerNamespace`-t a saját namespace-ükkel — így a
 * core sosem függ modultól, csak fordítva regisztrálnak bele.
 */
import { defaultLocale, locales, type Locale } from "./config";
import huCore from "./locales/hu/core.json";
import enCore from "./locales/en/core.json";

/** Egy namespace egy locale-hoz tartozó kulcs-fája (i18next resource bundle). */
export type NamespaceResources = Record<string, unknown>;

type ResourceRegistry = Record<string, Partial<Record<Locale, NamespaceResources>>>;

const registry: ResourceRegistry = {
  core: { hu: huCore, en: enCore },
};

/**
 * Bővítési pont modulonkénti namespace-ekhez, pl.
 * `registerNamespace("advisor", "hu", advisorHu)`.
 * Ismételt hívás (pl. HMR) felülírja az adott namespace/locale párost.
 */
export function registerNamespace(
  ns: string,
  locale: Locale,
  resources: NamespaceResources,
): void {
  const existing = registry[ns] ?? {};
  registry[ns] = { ...existing, [locale]: resources };
}

export function getRegisteredNamespaces(): string[] {
  return Object.keys(registry);
}

/**
 * Az i18next `resources` opciójának megfelelő alakra rendezi a regisztrált
 * namespace-eket: `{ [locale]: { [namespace]: resourceObject } }`.
 * Ha egy namespace-hez nincs kért locale-hoz tartozó fordítás, a
 * `defaultLocale` (hu) tartalma kerül be helyette — az i18next-fallback-lánc
 * emellett kulcsszinten is működik a `fallbackLng` beállításon keresztül.
 */
export function buildResourceBundle(): Record<Locale, Record<string, NamespaceResources>> {
  const bundle = {} as Record<Locale, Record<string, NamespaceResources>>;
  for (const locale of locales) {
    const nsMap: Record<string, NamespaceResources> = {};
    for (const [ns, byLocale] of Object.entries(registry)) {
      const resources = byLocale[locale] ?? byLocale[defaultLocale];
      if (resources) {
        nsMap[ns] = resources;
      }
    }
    bundle[locale] = nsMap;
  }
  return bundle;
}
