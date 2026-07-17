/**
 * Locale-URL séma helperek (FEJLESZTESI_DOKUMENTACIO 6. fejezet, 2. pont):
 * `hu` az alapértelmezett locale, PREFIX NÉLKÜL (`/deszkak/...`),
 * minden más locale (F1-ben csak `en`) prefixelt (`/en/boards/...`).
 */
import { defaultLocale, locales, type Locale } from "./config";

const prefixedLocales = new Set<string>(locales.filter((locale) => locale !== defaultLocale));

/** Vezető/záró perjelek normalizálása: `"deszkak/x/"` → `"/deszkak/x"`, `""` → `"/"`. */
function normalize(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

/** A pathname elején álló locale-prefixet olvassa ki; ha nincs, `defaultLocale` (hu). */
export function getLocaleFromPath(pathname: string): Locale {
  const [first] = normalize(pathname).split("/").filter(Boolean);
  if (first && prefixedLocales.has(first)) {
    return first as Locale;
  }
  return defaultLocale;
}

/**
 * Locale-független útvonalhoz (pl. `"/deszkak/x"`) hozzáilleszti a
 * locale-prefixet — a `defaultLocale`-hoz (hu) NEM tesz prefixet.
 */
export function localizePath(path: string, locale: Locale): string {
  const normalized = normalize(path);
  if (locale === defaultLocale) {
    return normalized;
  }
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

/** A pathname-ről leválasztja a locale-prefixet (ha van), a locale-független útvonalat adva vissza. */
export function stripLocale(pathname: string): string {
  const normalized = normalize(pathname);
  const segments = normalized.split("/").filter(Boolean);
  const [first, ...rest] = segments;
  if (first && prefixedLocales.has(first)) {
    return rest.length > 0 ? `/${rest.join("/")}` : "/";
  }
  return normalized;
}
