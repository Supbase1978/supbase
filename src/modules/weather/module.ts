/**
 * weather modul-manifeszt (1.3 modul-szerződés).
 *
 * F1.3-ban ROUTE-MENTES: a modul a SUP-index algoritmust és az Open-Meteo
 * adaptert adja, amit az F1.4 spot-oldalak fogyasztanak majd (loaderből). A
 * manifeszt szándékosan mellékhatás-mentes (csak típus-import), hogy a RR7
 * route-config loader könnyű maradjon; az i18n-namespace regisztrációja a
 * `./i18n` mellékhatás-modulban él (a route-modulok / i18n-bootstrap importálja).
 */
import type { ModuleManifest } from "@core/module-contract";

export const weatherModule: ModuleManifest = {
  id: "weather",
  routes: [],
  nav: [],
  i18nNamespace: "weather",
};

export default weatherModule;
