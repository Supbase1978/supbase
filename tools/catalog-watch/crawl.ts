/**
 * catalog-watch — crawl-orchestrátor (terv „A pipeline" szakasz).
 *
 * TISZTA modul: minden I/O (hálózat, adatbázis, idő, várakozás) INJEKTÁLT —
 * ugyanaz a minta, amit az Edge Functionök `_shared` rétege használ. Ezért a
 * teljes futás hálózat és adatbázis nélkül tesztelhető.
 *
 * Két megkötés, ami az egész pipeline értelmét adja:
 *  1. **A figyelő SOHA nem publikál magától.** Új vagy bizonytalan modell csak
 *     `catalog_candidates` sorba kerülhet; `boards`-ba írni kizárólag az
 *     admin-jóváhagyás tud (moderációs UI).
 *  2. **Udvarias crawl.** robots.txt tisztelet, kérések közti szünet, forrásonkénti
 *     felső korlát. Egy forrás hibája nem viszi el a többit (hibatűrő batch).
 */
import type {
  BoardForMatch,
  CatalogSourceRow,
  CrawlSummary,
  ExtractedProduct,
  SourceCrawlSummary,
} from "./types.ts";
import { htmlToText } from "./html.ts";
import { findProductNodes, pickPrimaryProduct } from "./jsonld.ts";
import { matchCandidate } from "./match.ts";
import { classifyProduct, extractProduct } from "./normalize.ts";
import {
  CRAWLER_USER_AGENT,
  crawlDelayFor,
  isPathAllowed,
  parseRobotsTxt,
  type RobotsTxt,
} from "./robots.ts";
import { expandShopifyProduct, fetchShopifyCatalog } from "./shopify.ts";
import { parseSitemap, selectProductUrls } from "./sitemap.ts";

/** Forrásonkénti felső korlát egy futásra (a `crawl_config` felülírhatja). */
export const DEFAULT_MAX_PRODUCTS = 200;
/** Kérések közti minimum szünet (a robots Crawl-delay ennél csak nagyobb lehet). */
export const DEFAULT_MIN_DELAY_MS = 1000;
/** Sitemap-indexből ennyi gyerek-sitemapet nézünk meg egy futásban. */
const MAX_CHILD_SITEMAPS = 10;
/** A summary hibalistájának felső korlátja (a log ne fusson el). */
const MAX_ERRORS_PER_SOURCE = 20;

export interface FetchResult {
  status: number;
  text: string;
}

/** Egyetlen hálózati primitív — a valós implementáció a cli.ts-ben él. */
export type FetchText = (url: string) => Promise<FetchResult>;

export interface CandidateInput {
  sourceId: string;
  url: string;
  raw: Record<string, unknown>;
  extracted: ExtractedProduct;
  matchedBoardId: string | null;
  confidence: number;
}

/** Az írási oldal — valós Supabase-store vagy dry-run gyűjtő implementálja. */
export interface CrawlStore {
  listBoardsForMatch(): Promise<BoardForMatch[]>;
  recordPrice(input: {
    boardId: string;
    shopName: string;
    url: string;
    priceHuf: number;
  }): Promise<void>;
  markBoardSeen(input: {
    boardId: string;
    seenAt: string;
    inStock: boolean | null;
  }): Promise<void>;
  /** `true`, ha ÚJ jelölt-sor jött létre (a már elbírált URL-t nem támasztjuk fel). */
  saveCandidate(input: CandidateInput): Promise<boolean>;
  markSourceCrawled(sourceId: string, at: string): Promise<void>;
}

export interface CrawlDeps {
  fetchText: FetchText;
  store: CrawlStore;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  log?: (message: string) => void;
  /**
   * OPCIONÁLIS böngésző-renderelt szöveg FALLBACKKÉNT (F2.1-utó-3): ha a sima
   * HTML-ből egyetlen méret sem jött ki (`render.ts` — a méret néhány bolton
   * csak JS-futás után jelenik meg). Hiányában (pl. tesztben) a fallback
   * egyszerűen kimarad, a crawl a sima HTTP-eredménnyel dolgozik tovább.
   */
  renderText?: (url: string) => Promise<string | null>;
}

function emptySummary(source: CatalogSourceRow): SourceCrawlSummary {
  return {
    sourceId: source.id,
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
}

function addError(summary: SourceCrawlSummary, message: string): void {
  if (summary.errors.length < MAX_ERRORS_PER_SOURCE) summary.errors.push(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * robots.txt betöltése. A HIÁNYZÓ robots.txt (404/410) a szabvány szerint
 * „minden engedélyezett"; a NEM ELÉRHETŐ (hálózati hiba, 5xx) viszont ismeretlen
 * állapot → `null`, és a hívó kihagyja a forrást.
 */
export async function loadRobots(origin: string, fetchText: FetchText): Promise<RobotsTxt | null> {
  try {
    const result = await fetchText(`${origin}/robots.txt`);
    if (result.status === 404 || result.status === 410) {
      return { groups: [], sitemaps: [] };
    }
    if (result.status >= 400) return null;
    return parseRobotsTxt(result.text);
  } catch {
    return null;
  }
}

/** A forráshoz tartozó sitemap-URL-ek sorrendben: konfig → robots → találgatás. */
function resolveSitemapUrls(source: CatalogSourceRow, robots: RobotsTxt, origin: string): string[] {
  const configured = source.crawl_config?.sitemapUrl;
  if (configured) return [configured];
  if (robots.sitemaps.length > 0) {
    // A termék-sitemap előbbre való, ha a neve elárulja magát.
    const preferred = robots.sitemaps.filter((url) => /product|termek|termék/i.test(url));
    return preferred.length > 0 ? preferred : robots.sitemaps;
  }
  return [`${origin}/sitemap.xml`];
}

/**
 * Termék-URL-ek összegyűjtése: sitemap (és egy szint sitemap-index) →
 * minta-szűrés → `maxProducts` vágás.
 */
export async function collectProductUrls(
  source: CatalogSourceRow,
  robots: RobotsTxt,
  origin: string,
  deps: CrawlDeps,
  summary: SourceCrawlSummary,
): Promise<string[]> {
  const config = source.crawl_config ?? {};
  const maxProducts = config.maxProducts ?? DEFAULT_MAX_PRODUCTS;
  const locs: string[] = [];

  const defaultSitemap = `${origin}/sitemap.xml`;
  const queue = resolveSitemapUrls(source, robots, origin);
  const tried = new Set(queue);
  let childrenFetched = 0;

  while (queue.length > 0) {
    const url = queue.shift() as string;
    let result: FetchResult;
    try {
      result = await deps.fetchText(url);
    } catch (error) {
      addError(summary, `sitemap ${url}: ${errorMessage(error)}`);
      continue;
    }
    if (result.status >= 400) {
      addError(summary, `sitemap ${url}: HTTP ${result.status}`);
      continue;
    }

    const parsed = parseSitemap(result.text);
    if (parsed.kind === "index") {
      for (const child of parsed.locs) {
        if (childrenFetched >= MAX_CHILD_SITEMAPS) break;
        // A kizáró minta a sitemap-indexre is él: a blog-sitemapet meg sem kérjük.
        if (
          config.excludeUrlPatterns?.some((pattern) =>
            child.toLowerCase().includes(pattern.toLowerCase()),
          )
        ) {
          continue;
        }
        childrenFetched += 1;
        queue.push(child);
      }
      continue;
    }
    locs.push(...parsed.locs);
    if (locs.length >= maxProducts * 5) break; // elég nyersanyag a szűréshez
  }

  // VISSZAESÉS: a robots.txt-ben hirdetett sitemap gyakran sablon-maradék
  // (élesben látott példa: `Sitemap: http://www.example.com/sitemap.xml`). Ha a
  // hirdetett forrásokból egyetlen URL sem jött, próbáljuk a SZABVÁNYOS helyet,
  // mielőtt „nincs termék"-et mondanánk.
  if (locs.length === 0 && !tried.has(defaultSitemap)) {
    return collectProductUrls(
      { ...source, crawl_config: { ...config, sitemapUrl: defaultSitemap } },
      robots,
      origin,
      deps,
      summary,
    );
  }

  const selected = selectProductUrls(locs, {
    productUrlPatterns: config.productUrlPatterns,
    excludeUrlPatterns: config.excludeUrlPatterns,
    maxProducts,
  });
  summary.urlsConsidered = selected.length;
  return selected;
}

/** Egy forrás teljes bejárása. Dobás helyett a hibákat a summary gyűjti. */
/**
 * Egy KINYERT termék sorsa: ismert deszka → `last_seen_at` (+ ársor), egyébként
 * besorolás után jelölt-sor. KÖZÖS a JSON-LD-s és a Shopify-ág között — a
 * „soha nem publikál magától" szabály (1. megkötés) így egyetlen helyen él.
 */
async function persistExtracted(input: {
  product: ExtractedProduct;
  url: string;
  raw: Record<string, unknown>;
  source: CatalogSourceRow;
  deps: CrawlDeps;
  summary: SourceCrawlSummary;
  boards: readonly BoardForMatch[];
  seenAt: string;
}): Promise<void> {
  const { product, url, raw, source, deps, summary, boards, seenAt } = input;

  const match = matchCandidate(product, boards);

  if (match.kind === "known" && match.boardId !== null) {
    summary.matchedKnown += 1;
    await deps.store.markBoardSeen({
      boardId: match.boardId,
      seenAt,
      inStock: product.inStock,
    });
    if (product.priceHuf !== null) {
      await deps.store.recordPrice({
        boardId: match.boardId,
        shopName: source.name,
        url,
        priceHuf: product.priceHuf,
      });
      summary.pricesRecorded += 1;
    }
    return;
  }

  // A boltok sitemapje evezőt, pumpát, ruházatot is tartalmaz. A jelölt-sor
  // deszkát VAGY a 3 követett felszerelés-kategóriát kaphatja (F2.3 3.
  // szakasz) — minden más `ignore` marad, különben használhatatlanná válik
  // a moderáció. (A fenti „ismert" ág ELŐBB van: meglévő deszka árát ez
  // nem blokkolja.)
  const classification = classifyProduct(product);
  if (classification.kind === "ignore") {
    summary.skippedNonBoard += 1;
    return;
  }

  const created = await deps.store.saveCandidate({
    sourceId: source.id,
    url,
    raw,
    extracted: product,
    matchedBoardId: match.boardId,
    confidence: match.confidence,
  });
  if (created) summary.candidatesCreated += 1;
}

/**
 * SHOPIFY-ÁG (F2.1-utó-14). A `/products.json` végpontról dolgozik, nem a
 * sitemapről: a Shopify-boltok termékoldalain a méret csak JS-futás után
 * jelenik meg, a `/products.json` viszont strukturáltan adja (a részletes
 * indoklás a `shopify.ts` fejlécében).
 *
 * A robots.txt itt is KÖTELEZŐ: a `/products.json` ugyanúgy egy útvonal, amit
 * a bolt megtilthat — ha tiltja, a forrás kimarad.
 */
async function crawlShopifySource(
  source: CatalogSourceRow,
  robots: RobotsTxt,
  origin: string,
  deps: CrawlDeps,
  summary: SourceCrawlSummary,
  delayMs: number,
): Promise<void> {
  const config = source.crawl_config ?? {};
  const shopify = config.shopify ?? {};
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? (() => Promise.resolve());
  const log = deps.log ?? (() => {});

  if (!isPathAllowed(robots, "/products.json", CRAWLER_USER_AGENT)) {
    addError(summary, "robots.txt tiltja a /products.json-t — a forrás kimarad");
    summary.robotsBlocked += 1;
    return;
  }

  const { products, errors } = await fetchShopifyCatalog(origin, deps.fetchText, {
    maxProducts: config.maxProducts ?? DEFAULT_MAX_PRODUCTS,
    productTypes: shopify.productTypes,
    sleep,
    delayMs,
  });
  for (const error of errors) addError(summary, error);

  const boards = await deps.store.listBoardsForMatch();
  const seenAt = now().toISOString();

  // Egy TERMÉK több jelöltté bomlik (méretenként egy) — a summary
  // `urlsConsidered` mezője ezért a variánsokat számolja, nem a lekért lapokat.
  let considered = 0;
  for (const shopifyProduct of products) {
    const expanded = expandShopifyProduct(shopifyProduct, origin, config.defaultBrandName ?? null);
    considered += expanded.length;
    for (const product of expanded) {
      summary.productsExtracted += 1;
      try {
        await persistExtracted({
          product,
          url: product.sourceUrl,
          raw: shopifyProduct as unknown as Record<string, unknown>,
          source,
          deps,
          summary,
          boards,
          seenAt,
        });
      } catch (error) {
        addError(summary, `${product.sourceUrl}: ${errorMessage(error)}`);
      }
    }
  }
  summary.urlsConsidered = considered;
  log(`[${source.name}] Shopify: ${products.length} termék → ${considered} méret-variáns`);
}

export async function crawlSource(
  source: CatalogSourceRow,
  deps: CrawlDeps,
): Promise<SourceCrawlSummary> {
  const summary = emptySummary(source);
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? (() => Promise.resolve());
  const log = deps.log ?? (() => {});

  if (!source.base_url) {
    addError(summary, "nincs base_url");
    return summary;
  }

  let origin: string;
  try {
    origin = new URL(source.base_url).origin;
  } catch {
    addError(summary, `érvénytelen base_url: ${source.base_url}`);
    return summary;
  }

  const robots = await loadRobots(origin, deps.fetchText);
  if (!robots) {
    // Ismeretlen robots-állapot → kihagyjuk a forrást (nem találgatunk).
    addError(summary, "robots.txt nem elérhető — a forrás kimarad");
    return summary;
  }

  const config = source.crawl_config ?? {};
  const robotsDelayMs = (crawlDelayFor(robots) ?? 0) * 1000;
  const delayMs = Math.max(config.minDelayMs ?? DEFAULT_MIN_DELAY_MS, robotsDelayMs);

  // Shopify-forrás: külön ág, sitemap helyett `/products.json` (F2.1-utó-14).
  // A `markSourceCrawled` UTÁNA ugyanúgy lefut, ezért itt csak a törzs cserélődik.
  if (config.shopify) {
    await crawlShopifySource(source, robots, origin, deps, summary, delayMs);
    try {
      await deps.store.markSourceCrawled(source.id, now().toISOString());
    } catch (error) {
      addError(summary, `last_crawled_at: ${errorMessage(error)}`);
    }
    return summary;
  }

  const urls = await collectProductUrls(source, robots, origin, deps, summary);
  log(`[${source.name}] ${urls.length} termék-URL, szünet ${delayMs} ms`);

  const boards = await deps.store.listBoardsForMatch();

  for (const url of urls) {
    let path: string;
    try {
      const parsed = new URL(url, origin);
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      addError(summary, `érvénytelen URL: ${url}`);
      continue;
    }
    if (!isPathAllowed(robots, path, CRAWLER_USER_AGENT)) {
      summary.robotsBlocked += 1;
      continue;
    }

    await sleep(delayMs);

    try {
      const page = await deps.fetchText(url);
      if (page.status >= 400) {
        addError(summary, `${url}: HTTP ${page.status}`);
        continue;
      }

      const node = pickPrimaryProduct(findProductNodes(page.text));
      if (!node) continue; // nem termékoldal — csendben tovább

      let product = extractProduct(node, url, htmlToText(page.text), config.defaultBrandName ?? null);
      if (!product) continue;
      summary.productsExtracted += 1;

      // Böngésző-renderelt fallback (F2.1-utó-3): csak akkor, ha a sima
      // HTML-ből a méret MINDHÁROM mezője hiányzott — ez a jele annak, hogy a
      // bolt a méretet csak JS-futás után írja a látható szövegbe. Drága
      // művelet, ezért szűk feltétellel hívjuk, és hibatűrő (sosem dob).
      const missingAllDimensions =
        deps.renderText &&
        product.specs.lengthCm === null &&
        product.specs.widthCm === null &&
        product.specs.thicknessCm === null;
      if (missingAllDimensions) {
        await sleep(delayMs);
        const renderedText = await deps.renderText!(url);
        if (renderedText !== null) {
          const rerendered = extractProduct(node, url, renderedText, config.defaultBrandName ?? null);
          if (rerendered) product = rerendered;
        }
      }

      await persistExtracted({
        product,
        url,
        raw: node,
        source,
        deps,
        summary,
        boards,
        seenAt: now().toISOString(),
      });
    } catch (error) {
      addError(summary, `${url}: ${errorMessage(error)}`);
    }
  }

  try {
    await deps.store.markSourceCrawled(source.id, now().toISOString());
  } catch (error) {
    addError(summary, `last_crawled_at: ${errorMessage(error)}`);
  }

  return summary;
}

/** Több forrás bejárása egymás után. Egy forrás hibája nem viszi el a többit. */
export async function crawlAll(
  sources: readonly CatalogSourceRow[],
  deps: CrawlDeps,
  options: { dryRun?: boolean } = {},
): Promise<CrawlSummary> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const summaries: SourceCrawlSummary[] = [];

  for (const source of sources) {
    if (!source.active) continue;
    try {
      summaries.push(await crawlSource(source, deps));
    } catch (error) {
      const summary = emptySummary(source);
      addError(summary, `váratlan hiba: ${errorMessage(error)}`);
      summaries.push(summary);
    }
  }

  return {
    startedAt,
    finishedAt: now().toISOString(),
    dryRun: options.dryRun ?? false,
    sources: summaries,
  };
}
