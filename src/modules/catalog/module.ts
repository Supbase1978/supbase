/**
 * catalog modul-manifeszt (1.3 modul-szerződés).
 *
 * A deszka-lista (`/deszkak`) és -adatlap (`/deszkak/:slug`) route-jai. Az
 * adatlap a `reviews` modul Népítélet-adatát is mutatja, de a KETTŐ össze-
 * kötése a ROUTE-rétegben történik (a catalog nem importál reviews-t —
 * modul→modul import tilos). A manifeszt mellékhatás-mentes (csak típus-import),
 * az i18n-namespace regisztrációja a `./i18n` mellékhatás-modulban él.
 */
import type { ModuleManifest } from "@core/module-contract";

export const catalogModule: ModuleManifest = {
  id: "catalog",
  routes: [
    { path: "deszkak", file: "routes/deszkak.tsx" },
    { path: "deszkak/:slug", file: "routes/deszkak.$slug.tsx" },
  ],
  nav: [{ labelKey: "nav.boards", path: "/deszkak", placement: "primary", order: 10 }],
  i18nNamespace: "catalog",
};

export default catalogModule;
