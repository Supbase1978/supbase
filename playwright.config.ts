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
  // A dev-szerver bemelegítése a tesztek előtt (Vite dep-optimalizálás) —
  // enélkül a párhuzamos tesztek egy épp újrainduló szerverbe futnának.
  globalSetup: "./e2e/global-setup.ts",
  // A hálózat (Supabase, térkép-csempe) lassú lehet — de a lassulás elfedné a
  // valódi regressziót, ezért a küszöb szoros marad. CI-ban valamivel bővebb:
  // ott hidegen indul a szerver, és a futók is lassabbak.
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: {
    timeout: 7_000,
    /**
     * SZIGORÚBB, mint az alapértelmezés — ez MÉRÉSSEL derült ki: a Playwright
     * gyári `threshold: 0.2` beállítása ELNYELTE, amikor az „Óvatosan"-jelvény
     * háttere véletlenül a `safe` tokenre váltott (két világos pasztell szín
     * érzékelt különbsége a küszöb alatt maradt). Egy vizuális teszt, ami ezt
     * nem fogja meg, nem véd semmitől.
     *
     * `maxDiffPixelRatio` nem 0: az élsimítás képkockánként pár pixelt
     * ingadozhat, ami hamis riasztást adna. Egy valódi token-csere ennél
     * nagyságrendekkel több pixelt érint.
     */
    toHaveScreenshot: { threshold: 0.05, maxDiffPixelRatio: 0.002 },
  },
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

  // A vizuális projekt a `testMatch`-csel VÁLIK KÜLÖN: a többi projekt nem
  // futtatja a visual.spec-et, és a visual projekt csak azt futtatja.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /visual\.spec\.ts/,
    },
    // Mobil: a projekt mobil-first (6. fejezet) — a layout-regressziók (pl. a
    // vízszintesen kicsúszó oldal) csak itt jönnek elő.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /visual\.spec\.ts/,
    },
    /**
     * VIZUÁLIS regresszió — SZÁNDÉKOSAN külön projekt, és a CI e2e-jobja NEM
     * futtatja. Oka: a Playwright a referencia-képeket platformonként tárolja
     * (a betűrenderelés eltér macOS és Linux között), az itteni referenciák
     * pedig macOS-en készültek. Linuxos CI-hoz egyszer le kell generálni:
     *   npx playwright test --project=visual --update-snapshots
     * A 10. fejezet a vizuális kaput amúgy is „release előtt"-re teszi.
     *
     * Futtatás: `npm run e2e:visual`
     */
    {
      name: "visual",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /visual\.spec\.ts/,
    },
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
