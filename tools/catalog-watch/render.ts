/**
 * catalog-watch — böngésző-renderelt szöveg FALLBACKKÉNT (F2.1-utó-3,
 * 2026-07-31 élesben mért hiány).
 *
 * MIÉRT KELL: néhány bolt (élesben mért: bluefinsupboards.eu több
 * termékvonala) a méret-adatot egy JS-változóból tölti a látható szövegbe
 * KIZÁRÓLAG a böngészőben — a nyers szerver-HTML-ben nincs ott (a
 * `crawl.ts` plain HTTP-fetchje ezt sosem látja). A vásárlónak látnia KELL
 * valahol (különben nem tudna vásárolni), tehát a JS lefutása UTÁN a
 * `document.body.innerText` tartalmazza — ezt adjuk vissza, hogy a MEGLÉVŐ
 * `parseSpecsFromText` címke-alapú parsere ugyanúgy fel tudja dolgozni,
 * mint a sima HTTP-fetch szövegét. NEM egyedi, bolt-specifikus JS-változót
 * olvasunk ki (az törékeny lenne) — a renderelt, EMBERI szemnek szánt
 * szöveget vesszük, ugyanazt, amit egy vásárló is lát.
 *
 * KÖLTSÉG MIATT FALLBACK, NEM ALAPÉRTELMEZETT: egy böngésző-indítás/oldal-
 * renderelés nagyságrendekkel drágább egy sima HTTP-kérésnél. A `crawl.ts`
 * csak akkor hívja, ha a sima HTML-ből a méret MINDHÁROM mezője (hossz/
 * szélesség/vastagság) hiányzott — ez ritka (élesben ~felén fordult elő egy
 * konkrét forrásnak), a többség sima fetchből is teljes.
 */
import { chromium, type Browser } from "@playwright/test";

export interface RenderFetcher {
  /**
   * Egy oldal JS-renderelt, EMBERI szemnek látható szövege, vagy `null` ha
   * a renderelés bármi okból nem sikerült (hálózat, timeout, hiányzó oldal —
   * SOHA nem dob, a hívó a sima HTTP-eredménnyel folytatja).
   */
  renderText(url: string): Promise<string | null>;
  /**
   * Egy termékoldal SPEC-TÁBLÁZATAI sor/cella mátrixként (F2.1-utó-16), vagy
   * `null`, ha egy sem jelent meg. Élesben mért igény: a star-board.com a
   * specifikációt egy külső Shopify-app (TablePress) táblájában közli, amit
   * JS tölt be — a nyers HTML-ben 0 `<table>` van, és a Shopify Section
   * Rendering API sem adja vissza. A tábla értelmezése NEM itt történik: ez a
   * réteg csak beolvas, a jelentést a tiszta `spec-table.ts` adja.
   */
  renderTables(url: string): Promise<string[][][] | null>;
  /** Böngésző-erőforrás felszabadítása a crawl végén. */
  close(): Promise<void>;
}

/**
 * Végiggörgeti az oldalt, hogy a lusta betöltésű blokkok is a DOM-ba kerüljenek.
 * Fix számú lépés és rövid szünetek: a cél nem a „minden betöltődött" garancia
 * (az nem is elérhető), hanem hogy a látómezőhöz kötött tartalom megjelenjen.
 * SOSEM dob — hiba esetén a hívó a meglévő szöveggel folytatja.
 */
async function autoScroll(page: {
  evaluate: (fn: () => void) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
}): Promise<void> {
  try {
    for (let step = 0; step < 8; step += 1) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch {
    // A görgetés nem kritikus: ami eddig betöltődött, az megmarad.
  }
}

/**
 * Lusta indítású böngésző: a `chromium.launch()` csak az ELSŐ `renderText`
 * híváskor fut le, nem a `createRenderFetcher()`-nél — ha egyetlen termék
 * sem igényli a fallbacket, a böngésző-indítás költsége el sem indul.
 */
export function createRenderFetcher(): RenderFetcher {
  let browserPromise: Promise<Browser> | null = null;

  async function getBrowser(): Promise<Browser> {
    if (!browserPromise) {
      browserPromise = chromium.launch({ headless: true });
    }
    return browserPromise;
  }

  return {
    async renderText(url: string): Promise<string | null> {
      try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        try {
          // "networkidle" SZÁNDÉKOSAN kerülve: élesben mért hiba — a modern
          // oldalak háttér-widgetei (chat, analitika) sosem engedik el a
          // hálózatot nyugalmi állapotba, ezért ez a stratégia megbízhatóan
          // időtúllépést adna. "domcontentloaded" + rövid várakozás elég a
          // kliens-oldali (Liquid/JS) tartalom kirenderelődéséhez.
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
          await page.waitForTimeout(1500);
          // GÖRGETÉS: a spec-tábla LUSTA betöltésű is lehet — élesben
          // (fanatic.com) a „SIZES AND SPECS" blokk csak akkor kerül a DOM-ba,
          // ha a látómezőbe ér. Egy vásárló is legörget érte; enélkül a
          // renderelt szöveg pontosan azt NEM tartalmazza, amiért a fallbacket
          // egyáltalán hívtuk.
          await autoScroll(page);
          const text = await page.evaluate(() => document.body.innerText);
          return typeof text === "string" && text.length > 0 ? text : null;
        } finally {
          await page.close();
        }
      } catch {
        // Fail-safe: a hívó a sima HTTP-fetch eredményével folytatja.
        return null;
      }
    },
    async renderTables(url: string): Promise<string[][][] | null> {
      try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
          // A táblákat külső app tölti be, ezért NEM elég a fix várakozás:
          // megvárjuk, míg legalább egy tábla ténylegesen sorokat kap. Ha nem
          // jön meg, a `catch` üres/null eredményt ad — sosem dobunk.
          await page
            .waitForFunction(() => document.querySelectorAll("table tr").length > 0, {
              timeout: 25_000,
            })
            .catch(() => {});
          const tables = await page.evaluate(() =>
            Array.from(document.querySelectorAll("table")).map((table) =>
              Array.from(table.querySelectorAll("tr")).map((row) =>
                Array.from(row.querySelectorAll("th,td")).map((cell) =>
                  (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
                ),
              ),
            ),
          );
          return tables.length > 0 ? tables : null;
        } finally {
          await page.close();
        }
      } catch {
        return null;
      }
    },
    async close(): Promise<void> {
      if (browserPromise) {
        const browser = await browserPromise;
        await browser.close();
      }
    },
  };
}
