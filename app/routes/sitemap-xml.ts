/**
 * /sitemap.xml — dinamikus, kétnyelvű sitemap (F1.8). Resource route: nincs
 * komponens, a loader közvetlenül XML-választ ad. A dinamikus slugokat a három
 * modul publikus adatrétegéből gyűjti (route-szintű kompozíció — a route bármely
 * modulból importálhat, 1.3), a statikus oldalakat a `STATIC_SITEMAP_PATHS` adja.
 */
import type { LoaderFunctionArgs } from "react-router";

import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { pickTranslated } from "@core/i18n";
import { defaultLocale } from "@core/i18n/config";
import { siteOrigin } from "@core/seo/page-seo";
import { buildSitemapXml, STATIC_SITEMAP_PATHS } from "@core/seo/sitemap";
import { listAccessories, listBoards } from "@modules/catalog/data/boards.server";
import { listProviders } from "@modules/providers/data/providers.server";
import { listSpots } from "@modules/spots/data/spots.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = siteOrigin(request);
  const { supabase } = createSupabaseServerClient(request);

  const [boards, accessories, spots, providers] = await Promise.all([
    listBoards(supabase),
    listAccessories(supabase),
    listSpots(supabase),
    listProviders(supabase),
  ]);

  // A slug locale-onként azonos (seed) — a hu-változatot vesszük locale-független
  // path-nak; a locale-prefixet a sitemap-builder teszi hozzá (lásd sitemap.ts).
  const paths = [
    ...STATIC_SITEMAP_PATHS,
    ...boards.map((b) => `/deszkak/${pickTranslated(b.slug, defaultLocale)}`),
    // F2.3 2. szakasz: termékszintű kiegészítők (MOST 0 sor, a katalógus még üres).
    ...accessories.map(
      (a) => `/felszereles/${a.accessory_type}/${pickTranslated(a.slug, defaultLocale)}`,
    ),
    ...spots.map((s) => `/spotok/${pickTranslated(s.slug, defaultLocale)}`),
    ...providers.map((p) => `/szolgaltatok/${pickTranslated(p.slug, defaultLocale)}`),
  ];

  const xml = buildSitemapXml(origin, paths);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
