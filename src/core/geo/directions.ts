/**
 * "Útvonal" link URL-je egy koordinátapárhoz — tiszta helper, se DOM-ot, se
 * i18n-t nem importál. A hívó (UI-komponens) dönti el a `platform`-ot:
 * SSR-en és az első kliens-render pillanatában mindig `"other"` (nincs
 * hydration-eltérés), a kliens EFFEKTBEN UA-sniffeléssel válthat `"apple"`-re
 * (lásd `@modules/spots/ui/DirectionsLink`).
 */

export type DirectionsPlatform = "apple" | "other";

/**
 * `apple`: Apple Maps (`maps.apple.com`) — iPhone/iPad/Mac natív térkép-appja
 * jobb célútvonal-élményt ad, mint a Google Maps-oldal.
 * `other`: Google Maps útvonaltervező — mindenhol máshol (Android, Windows,
 * Linux, és SSR/ismeretlen platform fail-safe alapértéke).
 */
export function buildDirectionsUrl(
  lat: number,
  lng: number,
  platform: DirectionsPlatform,
): string {
  if (platform === "apple") {
    return `https://maps.apple.com/?daddr=${lat},${lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
