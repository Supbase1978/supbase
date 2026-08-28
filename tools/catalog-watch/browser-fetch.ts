/**
 * catalog-watch — BÖNGÉSZŐ-HÁTTERŰ LETÖLTŐ (F2.1-utó-50, 2026-08-28 élesben
 * mérve a decathlon.hu-n).
 *
 * MIÉRT KELL, ÉS MIÉRT NEM ELÉG A MEGLÉVŐ `render.ts`: a `render.ts` FALLBACK
 * — akkor indul, ha a sima HTTP-letöltés MEGVOLT, csak hiányos. Van viszont
 * forrás, ahol a sima HTTP-letöltés MAGA lehetetlen:
 *
 *   * a decathlon.hu MINDEN HTML-oldalra `403`-at ad egy Cloudflare
 *     „Just a moment…" ellenőrzéssel (a `robots.txt` és a sitemapok
 *     kiszolgálódnak, tehát nem tiltásról van szó, hanem robot-védelemről);
 *   * ugyanez FEJ NÉLKÜLI Chrome-mal sem oldódik meg: 30 másodperc alatt sem
 *     jutott túl az ellenőrzésen (mérve mind a csomagolt chromiummal, mind a
 *     rendszer Chrome-jával);
 *   * FEJES (látható ablakú) Chrome-mal viszont 2 másodperc alatt átmegy, és
 *     a további oldalak már ellenőrzés nélkül jönnek ugyanabban a
 *     munkamenetben.
 *
 * Ezért ez a modul UGYANAZT a `FetchText` szerződést teljesíti, mint a
 * `cli.ts` valós hálózati primitívje — a `crawl.ts` egyetlen sorát sem kell
 * hozzáigazítani. A forrás receptje kapcsolja be (`browserFetch: true`).
 *
 * KORLÁT, AMIT TUDNI KELL: fejes böngésző kell hozzá, tehát a HAVI
 * GitHub-Actions futásban ez a forrás nem fog átmenni (a runner fej nélküli,
 * és a Cloudflare adatközponti IP-t is szigorúbban bírálja). A forrás
 * bejárása LOKÁLIS, kézi menet — a beírt specifikációt viszont a
 * `verify-specs` zárolja, tehát egyszeri bejárás után az adat marad.
 *
 * NEM KERÜLI MEG A ROBOTS.TXT-T: a `crawl.ts` ugyanúgy letölti és betartja,
 * csak épp ezen a csatornán. Azt kérjük le, amit egy vásárló is lát, a saját
 * böngészőnkkel, udvarias késleltetéssel.
 */
import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import type { FetchResult, FetchText } from "./crawl.ts";

/** A robot-ellenőrző átmeneti oldal címei (magyar és angol Cloudflare). */
const CHALLENGE_TITLE = /pillanat|moment|ellenőrz|checking your browser/i;

/** Meddig várjuk, hogy az ellenőrző oldal magától továbbengedjen. */
const CHALLENGE_TIMEOUT_MS = 30_000;
const CHALLENGE_POLL_MS = 1_500;

/** Navigációs időkorlát — a `cli.ts` HTTP-időkorlátjánál bővebb, mert renderel is. */
const NAVIGATION_TIMEOUT_MS = 40_000;

export interface BrowserFetcher {
  fetchText: FetchText;
  /** Böngésző-erőforrás felszabadítása. SOHA nem dob. */
  close(): Promise<void>;
}

/**
 * Végiggörgeti az oldalt, hogy a lusta betöltésű terméklista is a DOM-ba
 * kerüljön. A kategória-oldalak kártyái élesben CSAK görgetés után jelentek
 * meg. SOSEM dob — ami eddig betöltődött, az megmarad.
 */
async function autoScroll(page: {
  evaluate: (fn: () => void) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
}): Promise<void> {
  try {
    for (let step = 0; step < 12; step += 1) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch {
    // A görgetés nem kritikus.
  }
}

/**
 * Lusta indítású, FEJES böngésző. A rendszerre telepített Chrome-ot kérjük
 * (`channel: "chrome"`), mert a mérés szerint a csomagolt chromium
 * fingerprintje bukik az ellenőrzésen; ha nincs telepítve, a csomagolt
 * böngészővel próbálkozunk tovább — jobb egy esélyes menet, mint egy biztos
 * hiba az indításnál.
 */
export function createBrowserFetcher(): BrowserFetcher {
  let contextPromise: Promise<{ browser: Browser; context: BrowserContext }> | null = null;

  async function getContext(): Promise<BrowserContext> {
    if (!contextPromise) {
      contextPromise = (async () => {
        let browser: Browser;
        try {
          browser = await chromium.launch({ headless: false, channel: "chrome" });
        } catch {
          browser = await chromium.launch({ headless: false });
        }
        // EGYETLEN kontextus a teljes forrásra: a robot-ellenőrzés egyszer
        // fut le, a kapott sütit a további oldalak öröklik. Külön
        // kontextusonként újra kellene vizsgáztatni magunkat.
        const context = await browser.newContext({
          locale: "hu-HU",
          viewport: { width: 1400, height: 1000 },
        });
        return { browser, context };
      })();
    }
    return (await contextPromise).context;
  }

  const fetchText: FetchText = async (url: string): Promise<FetchResult> => {
    const context = await getContext();
    const page = await context.newPage();
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT_MS,
      });
      const contentType = response?.headers()["content-type"] ?? "";
      // NEM HTML (robots.txt, sitemap): a NYERS válasz kell, nem a
      // böngésző `<pre>`-be csomagolt megjelenítése — a robots-elemző
      // sorokra bont, és a becsomagolás elrontaná az első sort.
      if (contentType !== "" && !/html/i.test(contentType)) {
        const raw = await response?.text();
        return { status: response?.status() ?? 0, text: raw ?? "" };
      }

      // A ROBOT-ELLENŐRZÉS kivárása: az átmeneti oldal magától továbbenged,
      // csak nem azonnal. A `403` ilyenkor az ELLENŐRZŐ oldal státusza, nem
      // a végleges válaszé — ezért a címből döntünk, nem a státuszkódból.
      const deadline = Date.now() + CHALLENGE_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (!CHALLENGE_TITLE.test(await page.title())) break;
        await page.waitForTimeout(CHALLENGE_POLL_MS);
      }
      if (CHALLENGE_TITLE.test(await page.title())) {
        // Nem jutottunk át — a hívó ezt hibaként kezeli, ahogy egy 403-at is.
        return { status: 403, text: "" };
      }

      await page.waitForTimeout(1_500);
      await autoScroll(page);
      await page.waitForTimeout(1_000);
      return { status: 200, text: await page.content() };
    } finally {
      await page.close().catch(() => {});
    }
  };

  return {
    fetchText,
    async close(): Promise<void> {
      if (!contextPromise) return;
      try {
        const { browser } = await contextPromise;
        await browser.close();
      } catch {
        // Az indítás bukása nem viheti magával a futás lezárását
        // (F2.1-utó-47: a `close()` az elutasított ígéretet várta meg, és az
        // EGÉSZ crawl megállt tőle).
      }
    },
  };
}
