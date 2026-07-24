/**
 * i18n alap-konfiguráció (FEJLESZTESI_DOKUMENTACIO 8. fejezet).
 *
 * `hu` a forrás-locale és egyben az alapértelmezett (URL-prefix nélküli,
 * lásd 6. fejezet 2. pont); `en` F1-ben generált, élesítés a CEE-terjeszkedésnél.
 * Fallback-lánc mindenhol: kért locale → `defaultLocale` (hu).
 */

export const locales = ["hu", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "hu";

/**
 * ÉLŐ (routolható) locale-ok — a SEO-réteg (hreflang, sitemap, canonical) CSAK
 * ezeket hirdetheti, hogy ne mutasson crawlernek 404-es URL-re. F1-ben az `en`
 * fordítások megvannak, de a `/en/...` ÚTVONALAK még nincsenek bekötve (élesítés
 * a CEE-terjeszkedésnél) — ezért itt egyelőre CSAK `hu`. Amikor az en-routing
 * élesedik, vedd fel ide az `en`-t, és a hreflang/sitemap automatikusan hirdeti.
 */
export const activeLocales: readonly Locale[] = ["hu"];

/** Típusőr — pl. route-paraméterből vagy Accept-Language fejlécből érkező string ellenőrzésére. */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
