/**
 * Sitemap-XML builder (6. fejezet). Tiszta függvény — a route-loader gyűjti a
 * dinamikus slugokat (boards/spots/providers), ez állítja elő az XML-t.
 *
 * A bemenet locale-FÜGGETLEN path-ok listája (pl. `/deszkak/itiwit-x100-11-0`);
 * minden path-hoz locale-onként külön `<url>` készül, `<xhtml:link>` alternate-
 * ekkel (hu/en + x-default). EGYSZERŰSÍTÉS: a slug locale-onként azonosnak
 * feltételezett (a seed így tárolja), csak a locale-PREFIX tér el — ha később a
 * hu/en slug eltér, a path-generálást locale-onkéntire kell bővíteni.
 */
import { activeLocales, defaultLocale } from "@core/i18n/config";
import { localizePath } from "@core/i18n/url";

function alternateLinks(origin: string, path: string): string {
  const perLocale = activeLocales
    .map(
      (loc) =>
        `<xhtml:link rel="alternate" hreflang="${loc}" href="${origin}${localizePath(path, loc)}"/>`,
    )
    .join("");
  const xDefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${origin}${localizePath(path, defaultLocale)}"/>`;
  return perLocale + xDefault;
}

export function buildSitemapXml(origin: string, paths: readonly string[]): string {
  // CSAK élő locale-ok (activeLocales) — nincs 404-es /en URL a sitemapben.
  const urls = paths
    .map((path) => {
      const alternates = alternateLinks(origin, path);
      return activeLocales
        .map(
          (loc) =>
            `<url><loc>${origin}${localizePath(path, loc)}</loc>${alternates}</url>`,
        )
        .join("");
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">` +
    urls +
    `</urlset>`
  );
}

/** Statikus (nem entitás-alapú) publikus oldalak — a dinamikus slugok elé kerülnek. */
export const STATIC_SITEMAP_PATHS: readonly string[] = [
  "/",
  "/deszkak",
  "/spotok",
  "/deszkavalaszto",
  "/szolgaltatok",
  "/felszereles",
  // Felszerelés-kategóriák (F2.3 1. szakasz) — statikus tartalom, nincs slug.
  "/felszereles/evezo",
  "/felszereles/poraz",
  "/felszereles/mentomelleny",
  "/felszereles/pumpa",
  "/felszereles/szarazzsak",
  "/felszereles/ules",
  "/felszereles/uszony",
  "/felszereles/taska",
  "/aszf",
  "/adatvedelem",
];
