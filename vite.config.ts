import netlifyReactRouter from "@netlify/vite-plugin-react-router";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// A natív (Capacitor) build SPA-módú — nincs SSR, tehát Netlify-adapter sem
// kell hozzá (lásd react-router.config.ts: ssr = BUILD_TARGET !== "native").
// Ugyanaz a kódbázis, a platform-különbség csak itt és a platform.ts-ben él.
const isNativeBuild = process.env.BUILD_TARGET === "native";

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    // SSR-hosting Netlify Functionön (Node-runtime). Az Edge (Deno) változat
    // szándékosan NEM aktív: az SSR-loaderek a Supabase Node-kliensét
    // használják, és az edge-runtime váltás külön verifikációt igényelne.
    ...(isNativeBuild ? [] : [netlifyReactRouter()]),
  ],
});
