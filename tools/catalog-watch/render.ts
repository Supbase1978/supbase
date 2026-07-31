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
  /** Böngésző-erőforrás felszabadítása a crawl végén. */
  close(): Promise<void>;
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
          await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
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
    async close(): Promise<void> {
      if (browserPromise) {
        const browser = await browserPromise;
        await browser.close();
      }
    },
  };
}
