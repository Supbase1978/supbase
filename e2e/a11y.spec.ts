/**
 * Akadálymentesség (10. fejezet: „Playwright + axe-core a kulcsképernyőkön, AA").
 *
 * A `--danger`/státusz-szabályok miatt a kontraszt ITT dől el: a 2. fejezet
 * kimondja, hogy státusz sosem csak színnel jelenik meg (szín + ikon + szöveg),
 * és az amber CTA-n mindig sötét a felirat. Az axe a kontraszt- és
 * szerepkör-hibákat fogja meg.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** WCAG 2 A + AA szabálykészlet; a találatokat olvashatóan listázzuk. */
async function analyze(page: Page) {
  return await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
}

function format(violations: Awaited<ReturnType<typeof analyze>>["violations"]): string {
  return violations
    .map(
      (v) =>
        `${v.id} (${v.impact ?? "?"}): ${v.help}\n  ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join("\n  ")}`,
    )
    .join("\n\n");
}

const KEY_SCREENS: { name: string; path: string }[] = [
  { name: "kezdőlap", path: "/" },
  { name: "deszka-lista", path: "/deszkak" },
  { name: "spot-lista", path: "/spotok" },
  { name: "szolgáltatók", path: "/szolgaltatok" },
  { name: "Deszkaválasztó wizard", path: "/deszkavalaszto" },
  { name: "belépés", path: "/belepes" },
  { name: "regisztráció", path: "/regisztracio" },
  { name: "ÁSZF", path: "/aszf" },
  // Felszerelés-útmutató (F2.3 1. szakasz) — áttekintő + egy kategória-oldal
  // (a póráz, mert ott a SafetyNote is renderel, a kontraszt ott a legszigorúbb).
  { name: "felszerelés-áttekintő", path: "/felszereles" },
  { name: "felszerelés: póráz-útmutató", path: "/felszereles/poraz" },
];

for (const screen of KEY_SCREENS) {
  test(`a11y (WCAG AA): ${screen.name}`, async ({ page }) => {
    await page.goto(screen.path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    const { violations } = await analyze(page);
    expect(violations.length, `\n${format(violations)}`).toBe(0);
  });
}

test("a11y (WCAG AA): deszka-adatlap a Közös nevező mércékkel", async ({ page }) => {
  await page.goto("/deszkak");
  await page.locator('a[href^="/deszkak/"]').first().click();
  await expect(page.locator("#kozos-nevezo")).toBeAttached();

  const { violations } = await analyze(page);
  expect(violations.length, `\n${format(violations)}`).toBe(0);
});

test("a11y (WCAG AA): Deszkaválasztó eredménye", async ({ page }) => {
  await page.goto("/deszkavalaszto");
  await page.getByRole("spinbutton", { name: "Mennyi a testsúlyod?" }).fill("85");
  await page.getByRole("spinbutton", { name: "Milyen magas vagy?" }).fill("186");
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: /Tovább/ }).click();
  }
  await expect(page.getByText(/%\s*neked/).first()).toBeVisible();

  const { violations } = await analyze(page);
  expect(violations.length, `\n${format(violations)}`).toBe(0);
});
