/**
 * Playwright e2e-konfiguráció (F1.10, 10. fejezet „E2E" kapu).
 *
 * MI ELLEN FUT: alapból a `npm run dev` szerver ellen (`E2E_BASE_URL`-lel
 * felülírható). CI-ban a `supabase db start` lokális stackje adja az adatot,
 * ezért ott a seed determinisztikus; lokálisan a távoli „Supbase" projekt megy,
 * ahol dev-artefaktumok is vannak — EZÉRT a specek VISELKEDÉST állítanak, nem
 * pontos darabszámokat (egy „legalább 1 találat" jellegű assert mindkét
 * környezetben igaz marad).
 *
 * A biztonságkritikus utak (viharjelzés-render, adatkor) a spec 10. fejezete
 * szerint e2e-kapu alá tartoznak; az AUTH-os írási folyamatok (vélemény,
 * moderáció) szándékosan NINCSENEK itt: azok éles adatot írnának, és
 * böngésző-engedélyt/teszt-fiókot igényelnek — kézi runbook fedi őket
 * (docs/PROGRESS.md).
 */
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  // A hálózat (Supabase, térkép-csempe) lassú lehet — de a lassulás elfedné a
  // valódi regressziót, ezért a küszöb szoros marad.
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "hu-HU",
    timezoneId: "Europe/Budapest",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobil: a projekt mobil-first (6. fejezet) — a layout-regressziók (pl. a
    // vízszintesen kicsúszó oldal) csak itt jönnek elő.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  // Ha kívülről kapunk URL-t (CI preview vagy futó dev-szerver), nem indítunk sajátot.
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
