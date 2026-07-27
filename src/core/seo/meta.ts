/**
 * SEO meta- és hreflang-helperek (FEJLESZTESI_DOKUMENTACIO 6. fejezet).
 * Tiszta függvények — route-loaderek/`meta`/`links` exportjaiból hívhatók.
 */
import type { LinkDescriptor, MetaDescriptor } from "react-router";

import { activeLocales, defaultLocale, type Locale } from "@core/i18n/config";

import { OG_IMAGE_SIZE } from "./og-image";

export interface BuildMetaInput {
  title: string;
  description: string;
  /** Ha megadott, `<link rel="canonical">` is bekerül a meta-tömbbe. */
  canonicalUrl?: string;
  /**
   * ABSZOLÚT OG-kép-URL. A közösségi crawlerek a relatív útvonalat nem oldják
   * fel, ezért a hívó abszolutizálja (`resolveOgImage`).
   */
  imageUrl?: string;
}

/** RR7 `meta` exporthoz illeszkedő meta-descriptor tömb (title, description, OG, canonical). */
export function buildMeta({
  title,
  description,
  canonicalUrl,
  imageUrl,
}: BuildMetaInput): MetaDescriptor[] {
  const meta: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];

  if (imageUrl) {
    meta.push({ property: "og:image", content: imageUrl });
    meta.push({ property: "og:image:width", content: String(OG_IMAGE_SIZE.width) });
    meta.push({ property: "og:image:height", content: String(OG_IMAGE_SIZE.height) });
    // A kép önmagában nem hordoz információt a képernyőolvasónak — az `alt` a
    // lap címét ismétli, ami a megosztás kontextusában a leghasznosabb.
    meta.push({ property: "og:image:alt", content: title });
    // Kép nélkül a Twitter/X kis kártyát rajzol; képpel a nagy változat a jó.
    meta.push({ name: "twitter:card", content: "summary_large_image" });
  }

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
  // CSAK élő locale-ok (activeLocales) — nem hirdetünk crawlernek 404-es URL-t.
  const links: LinkDescriptor[] = activeLocales.map((locale) => ({
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
