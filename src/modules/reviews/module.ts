/**
 * reviews modul-manifeszt (1.3 modul-szerződés).
 *
 * A Népítélet (board_reviews) a catalog deszka-adatlapján jelenik meg, ezért a
 * modulnak NINCS saját publikus route-ja — a vélemény-írás/flag actionök a
 * `deszkak/:slug` route-on élnek (a route-réteg importálja a reviews adat-
 * rétegét; a reviews nem importál catalog-ot). Egyetlen felülete az admin
 * vélemény-moderáció panel. Mellékhatás-mentes (csak típus-import).
 */
import type { ModuleManifest } from "@core/module-contract";

export const reviewsModule: ModuleManifest = {
  id: "reviews",
  routes: [],
  nav: [],
  i18nNamespace: "reviews",
  adminPanels: [{ path: "velemenyek", file: "routes/admin.velemenyek.tsx" }],
};

export default reviewsModule;
