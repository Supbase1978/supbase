/**
 * spots modul-manifeszt (1.3 modul-szerződés).
 *
 * A modul a spot-lista + spot-részletező route-okat, az EWKB-geometria
 * parsert és a Supabase-lekérdezőket adja (3.1 séma: `spots`/`spot_reports`/
 * `weather_snapshots`). FONTOS: a spots-modul NEM importál a weather-
 * modulból (modul→modul import TILOS) — a SUP-index kiértékelés kizárólag
 * az app/routes/spotok*.tsx route-fájlokban köti össze a két modult (az
 * app-réteg bármely modult importálhat). A spots-modul emiatt saját,
 * minimális strukturális típusokat definiál a UI-propokhoz (lásd
 * `./types.ts`: `SpotStatus`, saját `StormLevel`) — ezek NEM a weather-modul
 * típusai.
 *
 * A manifeszt szándékosan mellékhatás-mentes (csak típus-import), hogy a RR7
 * route-config loader könnyű maradjon (lásd weather/module.ts mintáját); az
 * i18n-namespace regisztrációja a `./i18n` mellékhatás-modulban él.
 */
import type { ModuleManifest } from "@core/module-contract";

export const spotsModule: ModuleManifest = {
  id: "spots",
  routes: [
    { path: "spotok", file: "routes/spotok.tsx" },
    { path: "spotok/:slug", file: "routes/spotok.$slug.tsx" },
  ],
  nav: [{ labelKey: "nav.spots", path: "/spotok", placement: "primary", order: 20 }],
  i18nNamespace: "spots",
};

export default spotsModule;
