/**
 * providers modul-manifeszt (1.3 modul-szerződés).
 *
 * Szolgáltatói directory: lista (`/szolgaltatok`), profil (`/szolgaltatok/:slug`),
 * saját listing felvétele (`/szolgaltatok/uj`, "claim/regisztráció" — requireUser),
 * és admin-jóváhagyó panel (`/admin/szolgaltatok`, verifikálás). A profil-oldal a
 * `spots` modulhoz kötött helyszíneket is mutatja, de a KÉT modul összekötése a
 * ROUTE-rétegben történik (a providers nem importál spots-t — modul→modul tilos).
 * A manifeszt mellékhatás-mentes; az i18n-namespace a `./i18n` modulban regisztrál.
 */
import type { ModuleManifest } from "@core/module-contract";

export const providersModule: ModuleManifest = {
  id: "providers",
  routes: [
    // A statikus `uj` a RR7 route-rangsorban megelőzi a dinamikus `:slug`-ot.
    { path: "szolgaltatok", file: "routes/szolgaltatok.tsx" },
    { path: "szolgaltatok/uj", file: "routes/szolgaltatok.uj.tsx", requiresAuth: true },
    { path: "szolgaltatok/:slug", file: "routes/szolgaltatok.$slug.tsx" },
  ],
  nav: [{ labelKey: "nav.providers", path: "/szolgaltatok", placement: "primary", order: 20 }],
  i18nNamespace: "providers",
  adminPanels: [{ path: "szolgaltatok", file: "routes/admin.szolgaltatok.tsx" }],
};

export default providersModule;
