/**
 * catalog-watch — forrás-felderítés (terv 1. pont: „URL-t kap, felderíti a
 * forrás típusát — van-e sitemap? JSON-LD? feed?").
 *
 * Adatbázist NEM érint: egy URL-ről megmondja, alkalmas-e figyelt forrásnak,
 * és milyen `add-source` kapcsolókkal érdemes felvenni. Ezt futtatjuk MINDIG,
 * mielőtt egy boltot bekötnénk — így nem vakon veszünk fel forrást, amit aztán
 * az első crawl derít ki, hogy használhatatlan.
 *
 * Udvarias: robots.txt + sitemap + néhány minta-termékoldal, semmi több.
 */
import {
  collectProductUrls,
  loadRobots,
  type CrawlDeps,
  type FetchText,
} from "./crawl.ts";
import { htmlToText } from "./html.ts";
import { findProductNodes, pickPrimaryProduct } from "./jsonld.ts";
import { classifyProduct, extractProduct } from "./normalize.ts";
import { CRAWLER_USER_AGENT, crawlDelayFor, isPathAllowed } from "./robots.ts";
import type { ProductClassification } from "./normalize.ts";
import type { CatalogSourceRow, ExtractedProduct, SourceCrawlSummary } from "./types.ts";

/** Egy minta-termékoldal eredménye. */
export interface ProbeSample {
  url: string;
  status: number;
  /** Van-e schema.org Product JSON-LD (ez dönti el, hogy szelektor nélkül megy-e). */
  hasProductJsonLd: boolean;
  extracted: ExtractedProduct | null;
  /**
   * A `classifyProduct` döntése (F2.3 3. szakasz): `board` VAGY `accessory`
   * jelöltet kap a moderációs sor, `ignore` nem.
   */
  classification: ProductClassification | null;
}

export interface ProbeResult {
  origin: string;
  /** `false`, ha a robots.txt nem elérhető — ilyen forrást nem crawl-ozunk. */
  robotsAvailable: boolean;
  crawlDelaySec: number | null;
  /** A sitemapből kigyűjtött URL-ek száma (a minta-szűrés UTÁN). */
  productUrlCount: number;
  samples: ProbeSample[];
  errors: string[];
  /** Emberi összegzés + javasolt `add-source` parancs. */
  verdict: string;
  suggestedCommand: string | null;
}

export interface ProbeOptions {
  name?: string;
  productUrlPatterns?: string[];
  excludeUrlPatterns?: string[];
  sitemapUrl?: string;
  /** Hány termékoldalt nézzünk meg mintaként (default 3). */
  samples?: number;
}

function shellQuote(value: string): string {
  return /[^A-Za-z0-9._:/@-]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/**
 * Egy URL felderítése. A `fetchText` injektált (a CLI adja a valósat), így ez
 * a függvény is tesztelhető hálózat nélkül.
 */
export async function probeSource(
  baseUrl: string,
  options: ProbeOptions,
  deps: { fetchText: FetchText; sleep?: (ms: number) => Promise<void> },
): Promise<ProbeResult> {
  const errors: string[] = [];
  const sleep = deps.sleep ?? (() => Promise.resolve());

  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return {
      origin: baseUrl,
      robotsAvailable: false,
      crawlDelaySec: null,
      productUrlCount: 0,
      samples: [],
      errors: [`érvénytelen URL: ${baseUrl}`],
      verdict: "Érvénytelen URL.",
      suggestedCommand: null,
    };
  }

  const robots = await loadRobots(origin, deps.fetchText);
  if (!robots) {
    return {
      origin,
      robotsAvailable: false,
      crawlDelaySec: null,
      productUrlCount: 0,
      samples: [],
      errors: ["robots.txt nem elérhető (hálózati hiba vagy 5xx)"],
      verdict: "NEM alkalmas: a robots.txt nem elérhető, így nem tudjuk, mit szabad lekérni.",
      suggestedCommand: null,
    };
  }

  const source: CatalogSourceRow = {
    id: "probe",
    name: options.name ?? origin,
    base_url: origin,
    kind: "shop",
    country: "HU",
    discovery: "manual",
    crawl_config: {
      sitemapUrl: options.sitemapUrl,
      productUrlPatterns: options.productUrlPatterns,
      excludeUrlPatterns: options.excludeUrlPatterns,
      maxProducts: 5000,
    },
    active: true,
    last_crawled_at: null,
    added_by: null,
    created_at: new Date().toISOString(),
  };

  const summary: SourceCrawlSummary = {
    sourceId: "probe",
    sourceName: source.name,
    urlsConsidered: 0,
    productsExtracted: 0,
    skippedNonBoard: 0,
    matchedKnown: 0,
    candidatesCreated: 0,
    pricesRecorded: 0,
    robotsBlocked: 0,
    errors: [],
  };

  // A `collectProductUrls` csak a fetch-et és a naplózást használja a depsből;
  // a store itt nem hívódik, ezért a probe nem is ad valódit.
  const deps2 = { fetchText: deps.fetchText } as unknown as CrawlDeps;
  const urls = await collectProductUrls(source, robots, origin, deps2, summary);
  errors.push(...summary.errors);

  const delayMs = Math.max(1000, (crawlDelayFor(robots) ?? 0) * 1000);
  const sampleCount = options.samples ?? 3;
  const samples: ProbeSample[] = [];

  for (const url of urls) {
    if (samples.length >= sampleCount) break;
    let path: string;
    try {
      const parsed = new URL(url, origin);
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      continue;
    }
    if (!isPathAllowed(robots, path, CRAWLER_USER_AGENT)) continue;

    await sleep(delayMs);
    try {
      const page = await deps.fetchText(url);
      const nodes = page.status >= 400 ? [] : findProductNodes(page.text);
      const node = pickPrimaryProduct(nodes);
      const extracted = node ? extractProduct(node, url, htmlToText(page.text)) : null;
      samples.push({
        url,
        status: page.status,
        hasProductJsonLd: node !== null,
        extracted,
        classification: extracted !== null ? classifyProduct(extracted) : null,
      });
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const withJsonLd = samples.filter((sample) => sample.hasProductJsonLd).length;
  const withPrice = samples.filter((sample) => sample.extracted?.priceHuf !== null).length;

  let verdict: string;
  if (urls.length === 0) {
    verdict =
      "NEM alkalmas így: nem találtunk termék-URL-t. Próbáld explicit --sitemap URL-lel, " +
      "vagy szűkítsd/lazítsd a --pattern mintát.";
  } else if (withJsonLd === 0) {
    verdict =
      `${urls.length} URL megvan, de a minta-oldalakon NINCS Product JSON-LD — ` +
      "ez a forrás csak LLM-fallbackkal (F2+) vagy más mintával működne.";
  } else if (withPrice === 0) {
    verdict =
      `Használható (${withJsonLd}/${samples.length} mintán van Product JSON-LD), ` +
      "de ÁR nem jött ki — a jelöltek ár nélkül érkeznének.";
  } else if (samples.every((sample) => sample.classification?.kind === "ignore")) {
    verdict =
      `Használható (${withJsonLd}/${samples.length} mintán Product JSON-LD), de a mintákban ` +
      "csak figyelmen kívül hagyott termék volt (ruházat, apróság, vagy nem követett " +
      "felszerelés-kategória — póráz/szárazzsák/ülés/uszony/táska). A figyelő ezeket kiszűri; " +
      "szűkítsd a --pattern mintát a deszka- vagy evező/mentőmellény/pumpa-kategóriára.";
  } else {
    const boards = samples.filter((sample) => sample.classification?.kind === "board").length;
    const accessories = samples.filter(
      (sample) => sample.classification?.kind === "accessory",
    ).length;
    verdict =
      `ALKALMAS: ${urls.length} termék-URL, ${withJsonLd}/${samples.length} mintán Product ` +
      `JSON-LD, ${boards} deszka` +
      (accessories > 0 ? ` + ${accessories} követett felszerelés` : "") +
      ", ár is kijön.";
  }

  const patternFlags = (options.productUrlPatterns ?? [])
    .map((pattern) => ` --pattern ${shellQuote(pattern)}`)
    .join("");
  const excludeFlags = (options.excludeUrlPatterns ?? [])
    .map((pattern) => ` --exclude ${shellQuote(pattern)}`)
    .join("");
  const sitemapFlag = options.sitemapUrl ? ` --sitemap ${shellQuote(options.sitemapUrl)}` : "";

  return {
    origin,
    robotsAvailable: true,
    crawlDelaySec: crawlDelayFor(robots),
    productUrlCount: urls.length,
    samples,
    errors,
    verdict,
    suggestedCommand:
      urls.length > 0 && withJsonLd > 0
        ? `node tools/catalog-watch/cli.ts add-source --name ${shellQuote(
            options.name ?? origin,
          )} --url ${origin}${sitemapFlag}${patternFlags}${excludeFlags}`
        : null,
  };
}
