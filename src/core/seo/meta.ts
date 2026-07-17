/**
 * SEO meta- és hreflang-helperek (FEJLESZTESI_DOKUMENTACIO 6. fejezet).
 * Tiszta függvények — route-loaderek/`meta`/`links` exportjaiból hívhatók.
 */
import type { LinkDescriptor, MetaDescriptor } from "react-router";

import { defaultLocale, locales, type Locale } from "@core/i18n/config";

export interface BuildMetaInput {
  title: string;
  description: string;
  /** Ha megadott, `<link rel="canonical">` is bekerül a meta-tömbbe. */
  canonicalUrl?: string;
}

/** RR7 `meta` exporthoz illeszkedő meta-descriptor tömb (title, description, OG, canonical). */
export function buildMeta({ title, description, canonicalUrl }: BuildMetaInput): MetaDescriptor[] {
  const meta: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];

  if (canonicalUrl) {
    meta.push({ property: "og:url", content: canonicalUrl });
    meta.push({ tagName: "link", rel: "canonical", href: canonicalUrl });
  }

  return meta;
}

/**
 * `hreflang` alternate-linkek minden támogatott locale-hoz + `x-default`
 * (mindig `defaultLocale`, azaz hu — 6. fejezet 2. pont).
 *
 * @param pathForLocale abszolút URL-t ad vissza egy adott locale-hoz
 *   (pl. `(locale) => localizeAbsoluteUrl(basePath, locale)`).
 */
export function buildHreflangLinks(
  pathForLocale: (locale: Locale) => string,
): LinkDescriptor[] {
  const links: LinkDescriptor[] = locales.map((locale) => ({
    rel: "alternate",
    hrefLang: locale,
    href: pathForLocale(locale),
  }));

  links.push({
    rel: "alternate",
    hrefLang: "x-default",
    href: pathForLocale(defaultLocale),
  });

  return links;
}
