import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// A src/modules alatti modulok — a modul-szerződés határ-szabályaihoz.
// Új modul felvételekor ide is fel kell venni (F1.1–F1.9).
const MODULES = [
  "advisor",
  "catalog",
  "reviews",
  "spots",
  "weather",
  "providers",
  "profile",
  "admin",
];

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "build/**",
      ".react-router/**",
      "_design-source/**",
      "coverage/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      import: importPlugin,
      "react-hooks": reactHooks,
    },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // MODUL-SZERZŐDÉS (FEJLESZTESI_DOKUMENTACIO 1.3):
      // 1. modul → másik modul import TILOS (csak core + saját mappa);
      // 2. a core nem függhet moduloktól, sem az app rétegtől.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/core",
              from: "./src/modules",
              message:
                "A core nem függhet moduloktól — közös igény a core-ba kerül, nem fordítva.",
            },
            {
              target: "./src/core",
              from: "./app",
              message: "A core nem függhet az app route-rétegtől.",
            },
            {
              target: "./src/modules",
              from: "./app",
              message: "Modul nem függhet az app route-rétegtől.",
            },
            ...MODULES.map((mod) => ({
              target: `./src/modules/${mod}`,
              from: "./src/modules",
              except: [`./${mod}`],
              message: `Modul→modul import tilos (${mod}). Közös igény a core-ba kerül.`,
            })),
          ],
        },
      ],
    },
  },
  {
    // Supabase Edge Functions Deno-runtime alatt futnak: a `Deno` globális
    // itt ismert. A tiszta logika a `_shared`-ben Node/Vitest alatt is fut.
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      globals: { Deno: "readonly" },
    },
  },
);
