import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // vitest 5: environmentMatchGlobs megszűnt, helyette projects (`extends`
    // alapértelmezetten örökli a root configot — pluginok, aliasok stb.).
    // Komponens-tesztek (.tsx) DOM-ot igényelnek, a tiszta logika node-on fut.
    projects: [
      {
        test: {
          name: "dom",
          include: ["src/**/*.test.tsx", "app/**/*.test.tsx"],
          environment: "jsdom",
        },
      },
      {
        test: {
          name: "node",
          include: [
            "src/**/*.test.ts",
            "app/**/*.test.ts",
            "supabase/functions/**/*.test.ts",
            // catalog-watch (F2): a figyelő tiszta logikája a `src`-en kívül él.
            "tools/**/*.test.ts",
          ],
          environment: "node",
        },
      },
    ],
  },
});
