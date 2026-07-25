/**
 * /robots.txt — resource route (F1.8). Mindent enged a crawlereknek, az admin-
 * és a nem-indexelendő route-okat tiltja, és a sitemapre mutat (abszolút URL az
 * aktuális origin-nel).
 */
import type { LoaderFunctionArgs } from "react-router";

import { siteOrigin } from "@core/seo/page-seo";

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = siteOrigin(request);

  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /kijelentkezes",
    "Disallow: /auth/",
    "Disallow: /api/",
    "Disallow: /szolgaltatok/uj",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
