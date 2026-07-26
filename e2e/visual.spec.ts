/**
 * Vizuális regresszió a TOKEN-KRITIKUS komponensekre
 * (FEJLESZTESI_DOKUMENTACIO 10. fejezet „Vizuális" kapuja: waterline /
 * vízmérce / riasztás — release előtt).
 *
 * MI ELLEN VÉD: azt a hibaosztályt fogja meg, amit a viselkedés-tesztek nem —
 * a vizuális ELCSÚSZÁST és a token-elrontást. Az F1.10-es körben két ilyen is
 * felszínre került (mobil nav-túlcsordulás, fejléc↔tartalom eltérés), és
 * MINDKETTŐT felhasználói észrevétel találta meg, nem teszt.
 *
 * DETERMINIZMUS: a `/dev/vizualis` harness FIX propokkal renderel — élő adat
 * (óránként változó SUP-index, aszinkron térkép-csempék) nélkül. Az animációk
 * a `animations: "disabled"` kapcsolóval állnak. Így bármilyen eltérés VALÓDI
 * regresszió, nem zaj.
 *
 * PLATFORM-FÜGGŐSÉG (fontos): a Playwright a referencia-képeket platformonként
 * tárolja (`-darwin`, `-linux` utótag), mert a betűrenderelés eltér. Az itteni
 * referenciák macOS-en készültek, ezért ez a projekt a CI-ban NEM fut
 * (lásd `playwright.config.ts` — a `visual` projekt csak külön kérésre indul).
 * Linuxos CI-hoz egyszer le kell generálni a referenciákat a cél-platformon:
 *   npx playwright test --project=visual --update-snapshots
 * A spec 10. fejezete a vizuális kaput amúgy is „release előtt"-re teszi, nem
 * minden PR-re.
 */
import { expect, test } from "@playwright/test";

/** A harness blokkjai — az `id` a route-fájlban van rögzítve. */
const CASES = [
  { id: "vis-waterline", name: "vizfelszin-vonal" },
  { id: "vis-gauge", name: "vizmerce" },
  { id: "vis-statusbadge", name: "statusz-jelveny" },
  { id: "vis-ratingbar", name: "ertekelo-sav" },
  { id: "vis-buttons", name: "gombok" },
  { id: "vis-loadingwave", name: "betoltes-jelzo" },
] as const;

test.describe("vizuális regresszió — token-kritikus komponensek", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/vizualis");
    // A harness dev-only: produkciós buildben 404. Ha ide 404 jönne, a
    // hibaüzenet legyen beszédes, ne egy rejtélyes üres képernyőkép.
    await expect(page.getByRole("heading", { name: "Vizuális harness" })).toBeVisible();
  });

  for (const testCase of CASES) {
    test(testCase.name, async ({ page }) => {
      await expect(page.locator(`#${testCase.id}`)).toHaveScreenshot(`${testCase.name}.png`, {
        animations: "disabled",
      });
    });
  }
});

test("vizuális regresszió — II. fokú viharjelzés (teljes képernyős)", async ({ page }) => {
  await page.goto("/dev/vizualis?riasztas=1");
  // A riasztás `role="alertdialog"` — ha ez elveszne, az önmagában is hiba.
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page).toHaveScreenshot("viharjelzes-teljes-kepernyo.png", {
    animations: "disabled",
    fullPage: true,
  });
});
