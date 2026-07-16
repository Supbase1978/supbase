import type { Config } from "@react-router/dev/config";

// SSR a webre (SEO), SPA-mód a Capacitor natív buildekhez (F2).
// A kód nem tudhatja build-időben, melyik célra megy — platform-különbség
// kizárólag a src/core/platform.ts absztrakción keresztül kezelhető.
export default {
  ssr: process.env.BUILD_TARGET !== "native",
} satisfies Config;
