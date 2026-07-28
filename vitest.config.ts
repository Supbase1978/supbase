import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: [
      "src/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
      "supabase/functions/**/*.test.ts",
      // catalog-watch (F2): a figyelő tiszta logikája a `src`-en kívül él.
      "tools/**/*.test.ts",
    ],
    // Komponens-tesztek (.tsx) DOM-ot igényelnek, a tiszta logika node-on fut.
    environmentMatchGlobs: [
      ["**/*.test.tsx", "jsdom"],
      ["**/*.test.ts", "node"],
    ],
  },
});
