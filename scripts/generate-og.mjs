/**
 * A megosztás-kártya (`public/og/default.png`) generálása a `og-card.html`-ből.
 *
 * MIÉRT ÍGY: a MEGLÉVŐ Playwright-chromiummal rajzolunk, nem új futásidejű
 * függőséggel (satori + resvg ~8 MB-ot tenne a serverless csomagba). A kép
 * statikus, tehát elég build-időn KÍVÜL, kézzel legenerálni — a forrás
 * (`og-card.html`) commitolva van, így bármikor újraelőállítható.
 *
 * Futtatás:  node scripts/generate-og.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(ROOT, "scripts", "og-card.html");
const TARGET = join(ROOT, "public", "og", "default.png");
/** Az OG-szabvány szerinti méret (a `og:image:width/height` ezt hirdeti). */
const SIZE = { width: 1200, height: 630 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(SOURCE).href, { waitUntil: "load" });
await mkdir(dirname(TARGET), { recursive: true });
await page.screenshot({ path: TARGET, type: "png" });
await browser.close();

console.log(`[og] ${TARGET} — ${SIZE.width}×${SIZE.height}`);
