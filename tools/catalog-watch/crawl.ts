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
  CrawlConfig,
  CrawlSummary,
  ExtractedProduct,
  SourceCrawlSummary,
} from "./types.ts";
import { htmlToText } from "./html.ts";
import { findProductNodes, pickPrimaryProduct } from "./jsonld.ts";
import { matchCandidate } from "./match.ts";
import {
  classifyProduct,
  dimensionsAreCoherent,
  extractProduct,
  extractProductsFromPage,
} from "./normalize.ts";
import {
  CRAWLER_USER_AGENT,
  crawlDelayFor,
  isPathAllowed,
  parseRobotsTxt,
  type RobotsTxt,
} from "./robots.ts";
import {
  expandShopifyProduct,
  fetchShopifyCatalog,
  fetchShopifyCollectionIds,
  fetchShopifyCollectionTypes,
} from "./shopify.ts";
import { parseSitemap, selectProductUrls } from "./sitemap.ts";
import { fieldCoverage, findSuspicions } from "./suspicion.ts";
import { mergeSpecTables, normalizeSizeKey } from "./spec-table.ts";
import type { BoardSpecs, BoardType } from "./types.ts";

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
  /**
   * CSAK FRISSÍTÉS: ha ehhez az URL-hez nincs jelölt-sor, NE hozzon létre újat.
   *
   * MIÉRT KELL (F2.1-utó-39): ha egy termék már ISMERT deszkára illeszkedik, a
   * figyelő ársort ír és a jelölt-sorhoz hozzá sem nyúl. Így viszont egy még
   * elbírálatlan, RÉGI jelölt örökre a régi — és rosszabb — adatával marad,
   * hiába javítottuk azóta a kinyerést. Élesben kétszer is ez fogott meg:
   * a 210 cm-es ATLAS és 27 kategória nélküli Gladiator-jelölt.
   *
   * Újat azért nem hozunk létre, mert az ismert deszkához nem KELL jelölt — az
   * ár és a láthatóság a `board_prices`/`last_seen_at` útján megy.
   */
  refreshOnly?: boolean;
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
  /**
   * OPCIONÁLIS gyártói SPEC-TÁBLA beolvasás (F2.1-utó-16), a Shopify-ághoz:
   * a `/products.json` nem ad teherbírást, a gyártó viszont a termékoldalon
   * közli, JS-sel betöltött táblában. Hiányában (pl. tesztben) az ág kimarad.
   */
  renderTables?: (url: string) => Promise<string[][][] | null>;
}

/**
 * A gyártói spec-tábla ráolvasása egy méret-jelöltre. CSAK a HIÁNYZÓ mezőket
 * tölti: amit a `/products.json` már adott (hossz/szélesség a variáns-címből),
 * azt nem írja felül — az a konkrét variánsra vonatkozik, a tábla oszlopa
 * pedig illesztés eredménye.
 */
function applySpecTable(
  product: ExtractedProduct,
  sizeLabel: string,
  bySize: ReadonlyMap<string, BoardSpecs>,
): ExtractedProduct {
  if (sizeLabel === "") return product;
  const specs = bySize.get(normalizeSizeKey(sizeLabel));
  if (!specs) return product;

  return {
    ...product,
    specs: {
      ...product.specs,
      lengthCm: product.specs.lengthCm ?? specs.lengthCm,
      widthCm: product.specs.widthCm ?? specs.widthCm,
      thicknessCm: product.specs.thicknessCm ?? specs.thicknessCm,
      volumeL: product.specs.volumeL ?? specs.volumeL,
      weightKg: product.specs.weightKg ?? specs.weightKg,
      maxLoadKg: product.specs.maxLoadKg ?? specs.maxLoadKg,
    },
  };
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
    specTablesUsed: 0,
    coverage: [],
    suspicious: [],
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
    // A MÉG ELBÍRÁLATLAN jelölt-sort akkor is frissítjük, ha a termék közben
    // ismert deszkára illeszkedik. Enélkül a régi jelölt örökre a régi
    // adatával marad a moderátor előtt — élesben 27 kategória nélküli
    // Gladiator-jelöltet és a 210 cm-es ATLAS-t érintette. Újat nem hoz létre.
    await deps.store.saveCandidate({
      sourceId: source.id,
      url,
      raw,
      extracted: product,
      matchedBoardId: match.boardId,
      confidence: match.confidence,
      refreshOnly: true,
    });
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

  // A GYÁRTÓ saját kategóriái (kollekció-tagság) — ez üt a névből tippelt
  // típuson. Néhány extra kérés, terméktől függetlenül fix darabszám.
  let typeByProductId = new Map<string, BoardType>();
  if (shopify.collectionTypes && Object.keys(shopify.collectionTypes).length > 0) {
    const collections = await fetchShopifyCollectionTypes(
      origin,
      deps.fetchText,
      shopify.collectionTypes,
      { sleep, delayMs },
    );
    for (const error of collections.errors) addError(summary, error);
    typeByProductId = collections.byProductId;
    log(`[${source.name}] gyártói kategóriák: ${typeByProductId.size} termék`);
  }

  // KIZÁRT kollekciók (pl. szörf/wing): ezek termékei nem SUP-ok. A
  // `collectionTypes` ERŐSEBB — az átfedő modellek (Whopper, GO Surf) így
  // bent maradnak, mert a gyártó sík vízre is ajánlja őket.
  const excludedIds = new Set<string>();
  if (shopify.excludeCollections && shopify.excludeCollections.length > 0) {
    const excluded = await fetchShopifyCollectionIds(
      origin,
      deps.fetchText,
      shopify.excludeCollections,
      { sleep, delayMs },
    );
    for (const error of excluded.errors) addError(summary, error);
    for (const id of excluded.ids) {
      if (!typeByProductId.has(id)) excludedIds.add(id);
    }
    log(`[${source.name}] kizárt kollekciókból: ${excludedIds.size} termék`);
  }

  const boards = await deps.store.listBoardsForMatch();
  const seenAt = now().toISOString();

  // Egy TERMÉK több jelöltté bomlik (méretenként egy) — a summary
  // `urlsConsidered` mezője ezért a variánsokat számolja, nem a lekért lapokat.
  let considered = 0;
  for (const shopifyProduct of products) {
    if (excludedIds.has(String(shopifyProduct.id))) {
      summary.skippedNonBoard += 1;
      continue;
    }
    let expanded = expandShopifyProduct(
      shopifyProduct,
      origin,
      config.defaultBrandName ?? null,
      typeByProductId.get(String(shopifyProduct.id)) ?? null,
    );
    considered += expanded.length;

    // GYÁRTÓI SPEC-TÁBLA (F2.1-utó-16): a `/products.json` nem ad vastagságot,
    // súlyt és TEHERBÍRÁST — utóbbi viszont kötelező biztonsági mező a
    // Deszkaválasztóban, nélküle a deszka sosem kerül ajánlásba. A gyártó a
    // termékoldalon közli, JS-sel betöltött táblában. TERMÉKENKÉNT EGY
    // renderelés tölti fel az ÖSSZES méretét, ezért az ára elfogadható.
    const needsSpecs = expanded.some(
      ({ product }) =>
        product.accessoryType === null &&
        (product.specs.maxLoadKg === null ||
          product.specs.weightKg === null ||
          product.specs.thicknessCm === null),
    );
    if (needsSpecs && deps.renderTables && shopifyProduct.handle) {
      const productUrl = `${origin.replace(/\/+$/, "")}/products/${shopifyProduct.handle}`;
      await sleep(delayMs);
      const tables = await deps.renderTables(productUrl);
      if (tables) {
        // A táblát KIVITELENKÉNT kell értelmezni: egy cella több kivitel
        // adatát is tartalmazhatja („Deluxe: 10.5 kg Deluxe Lite: 9.60 kg"),
        // és a jelöltek kivitelenként külön sorok. A `mergeSpecTables` tiszta
        // függvény ugyanazon a — már letöltött — táblán fut, ezért a
        // kivitelenkénti újraértelmezés olcsó; a hálózatot nem terheli.
        const byConstruction = new Map<string, ReadonlyMap<string, BoardSpecs>>();
        let used = false;
        expanded = expanded.map((item) => {
          const key = item.construction ?? "";
          let bySize = byConstruction.get(key);
          if (!bySize) {
            bySize = mergeSpecTables(tables, item.construction);
            byConstruction.set(key, bySize);
          }
          if (bySize.size === 0) return item;
          used = true;
          return { ...item, product: applySpecTable(item.product, item.sizeLabel, bySize) };
        });
        if (used) summary.specTablesUsed += 1;
      }
    }

    for (const { product } of expanded) {
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

/**
 * EGY termékoldal kinyerése — a crawl és a fixtúra-tesztek KÖZÖS belépője.
 *
 * Miért külön függvény (F2.1-utó-36): a gyártónkénti regresszió-háló csak
 * akkor ér valamit, ha PONTOSAN azt futtatja, amit az éles crawl. Amíg ez a
 * logika a crawl-ciklus belsejében élt, egy teszt csak UTÁNOZNI tudta volna —
 * és az utánzat elcsúszik.
 *
 * JSON-LD NÉLKÜLI gyártói oldal (F2.1-utó-17): van forrás, ami nem tesz ki
 * schema.org `Product`-ot, a specifikációt viszont címkézett szövegként közli
 * (élesben: aquamarina.com). Csak explicit `htmlOnly` kapcsolóval, mert a
 * szöveg-alapú kinyerés lazább — és csak akkor ad jelöltet, ha a hossz tényleg
 * kijött (különben minden blogbejegyzés bekerülne).
 *
 * A `htmlOnly` ELSŐBBSÉGET élvez a JSON-LD-vel szemben: a kapcsoló épp azt
 * jelenti, hogy ennél a forrásnál a specifikáció a SZÖVEGBEN van. Élesben
 * (fanatic.com) a JSON-LD kitesz nevet és árat, de egyetlen méretet sem —
 * enélkül az a féladat nyerne, és a spec-tábla ki sem olvasódna.
 *
 * Egy oldal TÖBB deszkát is leírhat: van gyártó, amelyik a modellcsalád minden
 * méretét egyetlen spec-táblában sorolja fel (fanatic.com). A SUP-nál a méret
 * maga a termék, ezért ilyenkor méretenként külön jelölt születik — a
 * JSON-LD-ág változatlanul egy terméket ad.
 *
 * @param overrideText böngészőben renderelt oldalszöveg, ha van. `null`
 *   esetén a nyers HTML-ből képzett szöveggel dolgozik.
 */
export function extractPageProducts(
  html: string,
  url: string,
  config: CrawlConfig,
  overrideText: string | null,
): ExtractedProduct[] {
  const pageOptions = {
    boardTypeByUrl: config.boardTypeByUrl ?? {},
    titleSuffixes: config.titleSuffixes ?? [],
    titleCutAfter: config.titleCutAfter ?? [],
    titleNoiseWords: config.titleNoiseWords ?? [],
    categoryClass: config.categoryClass,
    // A recept által kért kategória-módszerek (F2.1-utó-45) — lista hiányában
    // mind fut, tehát a viselkedés változatlan.
    categoryMethods: config.categoryMethods,
    ...(overrideText === null ? {} : { overrideText }),
  };
  if (config.htmlOnly) {
    return extractProductsFromPage(html, url, config.defaultBrandName ?? null, pageOptions);
  }
  const node = pickPrimaryProduct(findProductNodes(html));
  if (node === null) return [];
  const text = overrideText ?? htmlToText(html);
  const product = extractProduct(node, url, text, config.defaultBrandName ?? null);
  return product === null ? [] : [product];
}

/**
 * Kell-e BÖNGÉSZŐ-RENDERELT szöveg (F2.1-utó-3, bővítve F2.1-utó-35)?
 *
 * Akkor, ha a sima HTML NEM HASZNÁLHATÓ. Három eset:
 *  * egyetlen méret sem jött ki (az eredeti, bluefinsupboards.eu);
 *  * a kijött méretek ELLENTMONDÁSOSAK — élesben (fanatic.com) a leírás
 *    prózájából `hossz 340,4 = vastagság 340,4` jött, és mivel a hossz nem
 *    volt üres, a fallback korábban el sem indult;
 *  * VAGY egyáltalán nem született termék. Ez utóbbi korábban `continue` volt:
 *    a fallback esélyt sem kapott azon az oldalon, ahol a spec-tábla
 *    KIZÁRÓLAG renderelés után létezik — épp ahol a legjobban kellett volna.
 *
 * Költség: a renderelés nagyságrendekkel drágább egy HTTP-kérésnél, ezért az
 * utolsó eset KÜLÖN KAPCSOLÓRA fut (`renderWhenEmpty`) — enélkül minden
 * nem-termék oldal (blog, kategória) is böngészőbe kerülne.
 */
export function needsRenderedText(
  products: readonly ExtractedProduct[],
  config: CrawlConfig,
): boolean {
  const first = products[0];
  if (first === undefined) return Boolean(config.renderWhenEmpty);
  const noDimensions =
    first.specs.lengthCm === null &&
    first.specs.widthCm === null &&
    first.specs.thicknessCm === null;
  return noDimensions || !dimensionsAreCoherent(first.specs);
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
  /** A futás ÖSSZES kinyert terméke — ebből lesz a mezőlefedettség. */
  const extractedAll: ExtractedProduct[] = [];

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

      let products = extractPageProducts(page.text, url, config, null);
      if (deps.renderText && needsRenderedText(products, config)) {
        await sleep(delayMs);
        // A RENDERELÉS BUKÁSA NEM VISZI A FUTÁST (F2.1-utó-47). A fallback
        // KÉNYELMI ág: ami nélküle kijött, az attól még jó. Élesben mért
        // eset: telepítetlen Playwright-böngésző (`Executable doesn't
        // exist…`), ami EGYETLEN, forrás-oldali elgépelés miatt indult el —
        // és a kivétel az EGÉSZ crawlt megállította a második URL-nél. A
        // crawler dokumentált ígérete ezzel szemben az, hogy egy oldal hibája
        // nem viszi a többit.
        const renderedText = await deps.renderText(url).catch((error: unknown) => {
          addError(summary, `${url}: renderelés sikertelen (${errorMessage(error)})`);
          return null;
        });
        if (renderedText !== null) {
          const rerendered = extractPageProducts(page.text, url, config, renderedText);
          if (rerendered.length > 0) products = rerendered;
        }
      }

      if (products.length === 0) continue;
      summary.productsExtracted += 1;
      for (const product of products) {
        // CSAK A DESZKÁKAT nézzük. Se a lefedettség, se a gyanú-jelek nem
        // értelmesek egy táskán vagy pumpán, a boltok sitemapje viszont tele
        // van velük.
        //
        // Az `extracted.accessoryType` NEM elég szűrő: az csak a KÖVETETT
        // felszerelés-kategóriákat tölti ki, minden más termék (hátizsák,
        // vízálló táska, ruházat) `null`-lal jön — vagyis deszkának látszik.
        // Élesben ez 83 „deszkát" számolt 47 helyett, és a jelentés hamisan
        // riasztott: 16 gyanús tétel, csupa táska. Egy hamisan riasztó
        // jelentést pedig pár nap után senki nem néz meg.
        if (classifyProduct(product).kind !== "board") continue;
        // A LEFEDETTSÉG a futás végén, a teljes szállítmányon számolódik: egy
        // hiányzó mező soronként semmit nem mond, forrás-szinten viszont
        // megkülönbözteti az egyedi hibát (19/20) a kinyerés hibájától (0/15).
        extractedAll.push(product);

        // GYANÚ-JELEK (F2.1-utó-38). NEM elutasítás: a termék megy tovább, de
        // a jel a GYŰJTÉSNÉL látszik — ott, ahol még meg lehet nézni, hogy
        // egyetlen modell oldala hibás-e, vagy az egész forrásé.
        const suspicions = findSuspicions(product);
        if (suspicions.length > 0) {
          summary.suspicious.push({
            modelName: product.modelName,
            url: product.sourceUrl,
            details: suspicions.map((item) => item.detail),
          });
        }
      }

      for (const product of products) {
        await persistExtracted({
          product,
          // A jelölt URL-je MÉRETENKÉNT egyedi (`?size=…`): a jelölt-sorokat a
          // figyelő URL szerint azonosítja, közös URL-lel a méretek
          // felülírnák egymást.
          url: product.sourceUrl,
          // JSON-LD nélküli oldalnál nincs mit nyersen eltenni — a `raw` a
          // moderátornak szóló nyomkövetés, üresen is értelmes.
          raw: pickPrimaryProduct(findProductNodes(page.text)) ?? {},
          source,
          deps,
          summary,
          boards,
          seenAt: now().toISOString(),
        });
      }
    } catch (error) {
      addError(summary, `${url}: ${errorMessage(error)}`);
    }
  }

  summary.coverage = fieldCoverage(extractedAll, config.unpublishedFields ?? []);

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
