/**
 * Request-tudatos SEO-összeállító (6. fejezet). A tiszta `meta.ts`-re épül, de
 * ismeri a kérést (origin) és a locale-URL-sémát, így egy hívással előállítja a
 * teljes, RR7 `meta`-exportba illeszkedő descriptor-tömböt: title/description/OG
 * + canonical + hreflang alternate-ek.
 *
 * A hreflang-linkek is a `meta`-tömbbe kerülnek (`tagName:"link"`), mert az RR7
 * `links` export NEM kap loaderData-t — a slug-függő alternate-eket viszont a
 * loaderben számoljuk. A loader a visszaadott tömböt a `seo` mezőben adja tovább,
 * a route `meta`-exportja pedig egyszerűen visszaadja (`({data}) => data?.seo ?? []`).
 */
import type { MetaDescriptor } from "react-router";

import { localizePath, type Locale } from "@core/i18n";

import { buildHreflangLinks, buildMeta } from "./meta";
import { resolveOgImage } from "./og-image";

type EnvRecord = Record<string, string | undefined>;

/**
 * Az oldal kanonikus origin-ja. Elsődlegesen a `VITE_PUBLIC_SITE_URL` env
 * (stabil éles domain a canonical/hreflang/OG-hoz); ha nincs beállítva, a kérés
 * origin-ja a fallback (dev + preview működik konfiguráció nélkül).
 */
export function siteOrigin(request: Request): string {
  const env = import.meta.env as unknown as EnvRecord;
  const configured = env.VITE_PUBLIC_SITE_URL;
  if (configured && configured.length > 0) {
    return configured.replace(/\/+$/, "");
  }
  return new URL(request.url).origin;
}

/** Abszolút, locale-helyes URL egy locale-független path-hoz (pl. `/deszkak/x`). */
export function absoluteUrl(request: Request, path: string, locale: Locale): string {
  return `${siteOrigin(request)}${localizePath(path, locale)}`;
}

export interface PageSeoInput {
  request: Request;
  locale: Locale;
  /** Locale-független útvonal, pl. `/deszkak` vagy `/deszkak/itiwit-x100-11-0`. */
  path: string;
  title: string;
  description: string;
  /**
   * Oldal-specifikus megosztás-kép (relatív VAGY abszolút). Hiányában a
   * márkázott alapértelmezett kártya megy — így egyetlen oldal sem marad kép
   * nélkül a megosztásokban.
   */
  imagePath?: string | null;
}

/**
 * Teljes SEO-meta descriptor-tömb (title/description/OG + canonical + hreflang).
 * A loaderből hívandó (szerver-oldali fordítással előállított title/description-nel).
 */
export function buildPageSeo({
  request,
  locale,
  path,
  title,
  description,
  imagePath,
}: PageSeoInput): MetaDescriptor[] {
  const origin = siteOrigin(request);
  const canonicalUrl = `${origin}${localizePath(path, locale)}`;

  const descriptors = buildMeta({
    title,
    description,
    canonicalUrl,
    imageUrl: resolveOgImage(origin, imagePath),
  });

  for (const link of buildHreflangLinks((loc) => `${origin}${localizePath(path, loc)}`)) {
    descriptors.push({ tagName: "link", ...link });
  }

  return descriptors;
}
