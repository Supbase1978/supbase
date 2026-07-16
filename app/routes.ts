import { type RouteConfig, index } from "@react-router/dev/routes";

// VÉKONY réteg: a route-fájlok csak modulokat komponálnak (1.3 modul-szerződés).
// A modul-route-ok a src/modules/registry.ts manifesztjeiből épülnek majd fel (F1.1+).
export default [index("routes/home.tsx")] satisfies RouteConfig;
