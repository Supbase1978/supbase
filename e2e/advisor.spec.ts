/**
 * Deszkaválasztó end-to-end (10. fejezet: „wizard → eredmény → adatlap").
 *
 * Ez a projekt legösszetettebb felhasználói útja: 5 lépéses kliens-wizard →
 * szerver-oldali kétrétegű algoritmus → eredmény-képernyő → deszka-adatlap.
 */
import { expect, test, type Page } from "@playwright/test";

/** Végigviszi a wizardot a megadott testadatokkal, alap-válaszokkal. */
async function runWizard(page: Page, weightKg: string, heightCm: string) {
  await page.goto("/deszkavalaszto");
  await page.getByRole("spinbutton", { name: "Mennyi a testsúlyod?" }).fill(weightKg);
  await page.getByRole("spinbutton", { name: "Milyen magas vagy?" }).fill(heightCm);
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: /Tovább/ }).click();
  }
  // Az EREDMÉNY-lap címére várunk, nem „bármilyen h1"-re: a wizardnak magának
  // is van h1-e (a11y), így az általános várakozás azonnal teljesülne, és a
  // teszt még a wizardon állva vizsgálódna.
  await expect(page.getByRole("heading", { name: "A te deszkáid" })).toBeVisible();
}

test.describe("Deszkaválasztó", () => {
  test("wizard → eredmény → adatlap", async ({ page }) => {
    await runWizard(page, "85", "186");

    // Legalább egy ajánlás, „X% neked" illeszkedés-jelöléssel.
    await expect(page.getByText(/%\s*neked/).first()).toBeVisible();

    // Az adatlap-link a katalógusba visz, és tényleg betölt.
    const detailLink = page.getByRole("link", { name: "Adatlap" }).first();
    await detailLink.click();
    await expect(page).toHaveURL(/\/deszkak\/[a-z0-9-]+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("a testsúly ÉS a magasság is kötelező (a wizard nem enged tovább)", async ({ page }) => {
    await page.goto("/deszkavalaszto");
    await page.getByRole("button", { name: /Tovább/ }).click();
    // Ugyanazon a lépésen maradunk, hibaüzenettel.
    await expect(page.getByRole("heading", { name: "Mennyi a testsúlyod?" })).toBeVisible();
    await expect(page.getByText(/testsúlyod 30 és 200|Add meg a testsúlyod/)).toBeVisible();
    await expect(page.getByText(/magasságod 120 és 220|Add meg a magasságod/)).toBeVisible();
  });

  test("a magasság HAT az ajánlásra: magasabbnak hosszabb deszka az ideális", async ({ page }) => {
    await runWizard(page, "85", "165");
    const shortText = await page.getByText(/hosszú deszka az ideális/).textContent();

    await runWizard(page, "85", "192");
    const tallText = await page.getByText(/hosszú deszka az ideális/).textContent();

    const idealCm = (text: string | null) => Number(/kb\.\s*(\d+)\s*cm/.exec(text ?? "")?.[1]);
    expect(idealCm(tallText)).toBeGreaterThan(idealCm(shortText));
  });

  test("a Közös nevező a kártyán látszik — nem kell átkattintani", async ({ page }) => {
    await runWizard(page, "85", "186");

    const card = page.locator("section", { hasText: "Legjobb választás" }).first();
    // Vagy értékelt (bontással), vagy őszinte üres-állapot — de a felhasználó
    // MINDENKÉPP kap információt a vélemények állásáról a választás helyén.
    // (A CI friss seedjében nincs vélemény, a lokális távoli DB-ben van — ezért
    // ágazunk, `exact`-tal, hogy a beágyazott szülő-elemek ne zavarjanak be.)
    const ratingLabel = card.getByText("Közös nevező", { exact: true });
    if ((await ratingLabel.count()) > 0) {
      for (const dim of ["Stabilitás", "Siklás", "Minőség", "Ár-érték"]) {
        await expect(card.getByText(dim, { exact: true })).toBeVisible();
      }
      await expect(card.getByText(/% ajánlaná/)).toBeVisible();
      await expect(card.getByRole("link", { name: "Vélemények" })).toHaveAttribute(
        "href",
        /#kozos-nevezo$/,
      );
    } else {
      await expect(card.getByText(/még nincs értékelés/)).toBeVisible();
    }
  });
});
