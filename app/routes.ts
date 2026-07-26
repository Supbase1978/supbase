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
  // Reg-bővítés (F1.8b): közösségi belépés + jelszó-visszaállítás.
  route("auth/oauth", "routes/auth.oauth.tsx"),
  route("elfelejtett-jelszo", "routes/elfelejtett-jelszo.tsx"),
  route("uj-jelszo", "routes/uj-jelszo.tsx"),
  // Retroaktív re-consent felület (F1.8) — a root-banner innen kér elfogadást.
  route("beleegyezes", "routes/beleegyezes.tsx"),
  // Vizuális regressziós harness (F1.10) — CSAK dev-módban szolgál ki; a
  // loader produkcióban 404-et dob, tehát nem kerül ki az éles oldalra.
  route("dev/vizualis", "routes/dev.vizualis.tsx"),
  // Push-feliratkozás API (F1.9) — resource route, a WebPushProvider hívja.
  route("api/push", "routes/api.push.ts"),
  // SEO resource route-ok (F1.8) — nincs komponens, a loader XML/text választ ad.
  route("sitemap.xml", "routes/sitemap-xml.ts"),
  route("robots.txt", "routes/robots-txt.ts"),
  // Jogi oldalak (F1.8) — statikus, kétnyelvű ÁSZF + adatvédelmi tájékoztató.
  route("aszf", "routes/aszf.tsx"),
  route("adatvedelem", "routes/adatvedelem.tsx"),
  ...moduleRoutes,
] satisfies RouteConfig;
