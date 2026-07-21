/**
 * advisor (Deszkaválasztó) modul-manifeszt (1.3 modul-szerződés).
 *
 * F1.6: a modul a tiszta kétrétegű ajánló-algoritmust (5.2), a konfig-olvasót
 * és az indoklás-kulcsokat adja, amit a `deszkavalaszto` wizard-route fogyaszt
 * (a catalog+reviews+advisor összekötése KIZÁRÓLAG a route-rétegben történik,
 * lásd app/routes/deszkavalaszto.tsx). A manifeszt szándékosan mellékhatás-mentes
 * (csak típus-import), hogy a RR7 route-config loader könnyű maradjon; az
 * i18n-namespace regisztrációja a `./i18n` mellékhatás-modulban él.
 */
import type { ModuleManifest } from "@core/module-contract";

export const advisorModule: ModuleManifest = {
  id: "advisor",
  routes: [{ path: "deszkavalaszto", file: "routes/deszkavalaszto.tsx" }],
  nav: [{ labelKey: "nav.advisor", path: "/deszkavalaszto", placement: "primary", order: 5 }],
  i18nNamespace: "advisor",
};

export default advisorModule;
