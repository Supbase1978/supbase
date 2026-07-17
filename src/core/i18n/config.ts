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

/** Típusőr — pl. route-paraméterből vagy Accept-Language fejlécből érkező string ellenőrzésére. */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
