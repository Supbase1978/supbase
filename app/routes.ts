import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Relatív import: ezt a fájlt a RR7 config-loadere külön vite-node
// kontextusban értékeli ki, ahol a tsconfig-aliasok (@modules/*) nem élnek.
import { modules } from "../src/modules/registry";

// VÉKONY réteg: a route-fájlok csak modulokat komponálnak (1.3 modul-szerződés).
// Új modul route-jai a src/modules/registry.ts manifesztjéből jönnek — ehhez a
// fájlhoz új modul felvételekor NEM kell nyúlni. A `requiresAuth` flaget a
// route-fájl kényszeríti ki (core/auth requireUser a loaderben/actionben).
const moduleRoutes = modules.flatMap((mod) => [
  ...mod.routes.map((r) => route(r.path, r.file)),
  ...(mod.adminPanels ?? []).map((r) => route(`admin/${r.path}`, r.file)),
]);

export default [
  index("routes/home.tsx"),
  // Auth (F1.1, 4. fejezet) — hu alap-locale, prefix nélkül.
  route("belepes", "routes/belepes.tsx"),
  route("regisztracio", "routes/regisztracio.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("kijelentkezes", "routes/kijelentkezes.tsx"),
  ...moduleRoutes,
] satisfies RouteConfig;
