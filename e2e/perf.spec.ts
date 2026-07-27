/**
 * Teljesítmény-kapu (F1.10, 10. fejezet „LCP < 2,5 s") — az utolsó nyitott
 * audit-hiány (`docs/AUDIT_F1.md` 6.1).
 *
 * MI ELLEN FUT: a PRODUKCIÓS build (`scripts/serve-build.mjs`), nem a
 * dev-szerver. A dev-szerver nem bundle-öl és HMR-kódot is szállít — abból
 * mért LCP semmit nem mondana.
 *
 * HOGYAN MÉR: a Lighthouse „mobile" profiljának megfelelő fojtással (150 ms
 * RTT / 1,6 Mbps / 4× lassabb CPU), CDP-n keresztül. Fojtás nélkül minden
 * localhost-mérés néhány száz ms lenne, és a kapu semmit nem fogna meg.
 *
 * MIT NEM ÍGÉR: ez NEM field-LCP. A lokális szerver tömörít (br/gzip, mint a
 * Netlify), de nincs HTTP/2 és nincs CDN-távolság — a valós élmény ettől ELTÉR.
 * A kapu REGRESSZIÓT fog (pl. ha egy nehéz csomag bekerül a kezdő betöltésbe),
 * nem abszolút élményt igazol. A valós méréshez a publikussá tétel után élő URL
 * kell (`PERF_BASE_URL=https://… npm run e2e:perf`).
 *
 * Futtatás: `npm run e2e:perf` (buildel + elindítja a produkciós szervert).
 * A CI-ban SZÁNDÉKOSAN nem fut: az osztott futók CPU-ja ingadozik, abból
 * időalapú küszöb hamis pirosat adna (a vizuális kapuval azonos indok).
 */
import { expect, test, type Page } from "@playwright/test";

/** Lighthouse „Slow 4G" + 4× CPU — a mobil profil alapértelmezése. */
const THROTTLE = {
  latencyMs: 150,
  downloadBps: (1.6 * 1024 * 1024) / 8,
  uploadBps: (750 * 1024) / 8,
  cpuSlowdown: 4,
};

/**
 * Küszöbök. A SPEC célja LCP < 2,5 s; a mért értékek ennél lényegesen jobbak
 * (lásd a PROGRESS F1.10/9 szakaszát), a küszöb mégis a spec-célon marad —
 * egy szorosabb küszöb a gépek közti szórásra bukna, nem valódi regresszióra.
 * A JS-budget viszont MÉRT értékhez van igazítva (~30 % fejtér), mert az
 * determinisztikus: ugyanaz a build ugyanannyi bájt.
 */
const LCP_BUDGET_MS = 2_500;
/** Tömörített (brotli) átvitt JS. Mért érték → budget: kb. 35 % fejtérrel. */
const JS_BUDGET_KB: Record<string, number> = {
  "/": 180, // mért: 130 kB
  "/deszkak": 180, // mért: 132 kB
  "/deszkavalaszto": 190, // mért: 135 kB
  // A térkép-route SZÁNDÉKOSAN nehezebb: a MapLibre a funkció maga.
  "/spotok": 520, // mért: 395 kB
};

type PerfSample = {
  lcpMs: number;
  jsKb: number;
  scripts: string[];
};

async function measure(page: Page, path: string): Promise<PerfSample> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: THROTTLE.latencyMs,
    downloadThroughput: THROTTLE.downloadBps,
    uploadThroughput: THROTTLE.uploadBps,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE.cpuSlowdown });

  // A megfigyelőnek a NAVIGÁCIÓ ELŐTT kell felállnia: az LCP-bejegyzés a
  // betöltés első pillanataiban keletkezik.
  await page.addInitScript(() => {
    (window as unknown as { __lcp: number }).__lcp = 0;
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) (window as unknown as { __lcp: number }).__lcp = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.goto(path, { waitUntil: "load" });
  // Az LCP a betöltés után is nőhet (későn érkező kép/betű). A hálózat
  // elcsendesedése a jelzés, hogy a jelölt véglegessé vált.
  await page.waitForLoadState("networkidle").catch(() => {
    /* a térkép-csempék folyamatosan töltenek — a load utáni állapot is elég */
  });

  return page.evaluate(() => {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const scripts = resources.filter(
      (entry) => entry.initiatorType === "script" || entry.name.endsWith(".js"),
    );
    return {
      lcpMs: Math.round((window as unknown as { __lcp: number }).__lcp),
      // `transferSize` cross-origin, Timing-Allow-Origin nélkül 0 — a saját
      // (azonos origin) JS-ünk viszont pontosan látszik, és a budget arról szól.
      jsKb: Math.round(scripts.reduce((sum, entry) => sum + entry.transferSize, 0) / 1024),
      scripts: scripts.map((entry) => new URL(entry.name).pathname),
    };
  });
}

for (const [path, jsBudgetKb] of Object.entries(JS_BUDGET_KB)) {
  test(`teljesítmény-budget: ${path}`, async ({ page }) => {
    const sample = await measure(page, path);
    console.log(`[perf] ${path} — LCP ${sample.lcpMs} ms · JS ${sample.jsKb} kB`);

    // 0 LCP = nem volt mérhető tartalom-festés; az is hiba (üres oldal).
    expect(sample.lcpMs, `${path}: nem keletkezett LCP-bejegyzés`).toBeGreaterThan(0);
    expect(sample.lcpMs, `${path}: LCP-budget túllépve`).toBeLessThan(LCP_BUDGET_MS);
    expect(sample.jsKb, `${path}: JS-budget túllépve`).toBeLessThan(jsBudgetKb);
  });
}

/**
 * A legnagyobb kliens-csomag a MapLibre (~800 kB). Ha egy szerkesztés miatt a
 * térkép-import kikerülne a dinamikus ágból, MINDEN oldal megfizetné — a
 * budget-teszt ezt fogná ugyan, de ez a teszt MEGNEVEZI az okot.
 */
test("a MapLibre csak a térképes útvonalon töltődik", async ({ page }) => {
  const withoutMap = await measure(page, "/deszkak");
  expect(withoutMap.scripts.filter((name) => name.includes("maplibre"))).toEqual([]);

  const withMap = await measure(page, "/spotok");
  expect(withMap.scripts.some((name) => name.includes("maplibre"))).toBe(true);
});
