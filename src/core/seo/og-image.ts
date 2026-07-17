/**
 * OG-kép helper — STUB (FEJLESZTESI_DOKUMENTACIO 6. fejezet, 5. pont).
 * Az F1.8-ban kap valós generáló implementációt (deszkánként/spotonként
 * megosztás-kártya); itt csak egy determinisztikus, kirajzolható útvonalat
 * ad vissza, hogy a hívó oldalak (og:image meta) már most beköthetők legyenek.
 */

export type OgImageKind = "board" | "spot" | "provider" | "advisor-result";

/** Determinisztikus placeholder-útvonal, pl. `/og/board/vandor-11-4-tura.png`. */
export function ogImageUrl(kind: OgImageKind, slug: string): string {
  return `/og/${kind}/${encodeURIComponent(slug)}.png`;
}
