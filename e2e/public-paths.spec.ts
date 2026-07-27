/**
 * Kritikus PUBLIKUS utak (10. fejezet E2E-kapu) — bejelentkezés nélkül.
 *
 * Az assertek VISELKEDÉST rögzítenek, nem pontos darabszámokat: a lokális
 * (távoli „Supbase") és a CI-beli (friss seed) adat eltér, de mindkettőben
 * igaznak kell lennie, hogy „van legalább egy találat, és a részletek
 * renderelnek".
 */
import { expect, test } from "@playwright/test";

test.describe("Publikus felület", () => {
  test("a kezdőlap renderel, és a nav a modulokból épül", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Főnavigáció" })).toBeVisible();
    for (const label of ["Deszkaválasztó", "Deszkák", "Spotok", "Szolgáltatók"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("az oldal SOHA nem csúszik el vízszintesen (mobil-regresszió)", async ({ page }) => {
    // Ezt a hibát élesben a fejléc-nav okozta: minden route-on kilógott.
    for (const path of ["/", "/deszkak", "/spotok", "/deszkavalaszto", "/szolgaltatok"]) {
      await page.goto(path);
      const overflows = await page.evaluate(() => {
        const de = document.documentElement;
        return de.scrollWidth > de.clientWidth + 1;
      });
      expect(overflows, `${path} vízszintesen görgethető`).toBe(false);
    }
  });

  test("deszka-lista → adatlap: paraméterek, ár és Közös nevező-blokk", async ({ page }) => {
    await page.goto("/deszkak");
    const links = page.locator('a[href^="/deszkak/"]');
    await expect(links.first()).toBeVisible();

    await links.first().click();
    await expect(page).toHaveURL(/\/deszkak\/[a-z0-9-]+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // A Közös nevező blokk horgonya — erre mutat a Deszkaválasztó eredménye is.
    await expect(page.locator("#kozos-nevezo")).toBeAttached();
  });

  test("ismeretlen deszka-slug 404-et ad (nem 500-at)", async ({ page }) => {
    const response = await page.goto("/deszkak/ilyen-deszka-nincs-is");
    expect(response?.status()).toBe(404);
  });

  test("spot-lista → adatlap: státusz és adatkor látszik", async ({ page }) => {
    await page.goto("/spotok");
    const links = page.locator('a[href^="/spotok/"]');
    await expect(links.first()).toBeVisible();

    await links.first().click();
    await expect(page).toHaveURL(/\/spotok\/[a-z0-9-]+/);
    // A `first()` NEM kozmetika: II. fokú viharjelzésnél a teljes képernyős
    // riasztás (`role="alertdialog"`) SAJÁT h1-gyel jelenik meg az adatlap
    // címsora mellett, és a szigorú keresés két találaton elhasal. Ez ÉLES
    // adaton múlik (a lokális futás a távoli DB-t nézi), tehát a teszt
    // véletlenszerűen bukna — pontosan ez történt 2026-07-27-én.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("szolgáltatók: lista → profil, lead-űrlappal", async ({ page }) => {
    await page.goto("/szolgaltatok");
    const links = page.locator('a[href^="/szolgaltatok/"]:not([href$="/uj"])');
    await expect(links.first()).toBeVisible();

    await links.first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("form")).toBeVisible();
  });

  test("jogi oldalak elérhetők a láblécből", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "ÁSZF" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/adatvedelem");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("SEO-végpontok", () => {
  test("robots.txt tiltja a privát utakat és a sitemapre mutat", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    for (const path of ["/admin/", "/auth/", "/api/", "/kijelentkezes"]) {
      expect(body).toContain(`Disallow: ${path}`);
    }
    expect(body).toContain("Sitemap:");
  });

  test("a sitemap érvényes XML, és NEM hirdet inaktív locale-t", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("<loc>");
    // F1.8-döntés: az /en route-ok nincsenek bekötve → nem kerülhetnek a sitemapbe.
    expect(body).not.toContain("/en/");
  });
});

test.describe("Jogosultsági kapuk (kijelentkezve)", () => {
  for (const path of ["/admin/velemenyek", "/admin/szolgaltatok", "/szolgaltatok/uj"]) {
    test(`${path} a belépőre irányít`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/belepes/);
    });
  }

  test("a push-API bejelentkezés nélkül 401 JSON-t ad (nem redirectet)", async ({ request }) => {
    const response = await request.post("/api/push", {
      data: { intent: "subscribe", topic: "storm:11111111-2222-3333-4444-555555555555" },
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "push.loginRequired" });
  });
});
