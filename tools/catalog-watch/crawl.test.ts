import { describe, expect, it } from "vitest";

import {
  applySpecTable,
  crawlAll,
  crawlSource,
  type CandidateInput,
  type CrawlStore,
} from "./crawl.ts";
import { EMPTY_SPECS, type ExtractedProduct } from "./types.ts";
import type { BoardForMatch, CatalogSourceRow } from "./types.ts";

const ORIGIN = "https://bolt.hu";

const SOURCE: CatalogSourceRow = {
  id: "src-1",
  name: "Teszt Bolt",
  base_url: ORIGIN,
  kind: "shop",
  country: "HU",
  discovery: "manual",
  crawl_config: { productUrlPatterns: ["/termek/"], minDelayMs: 10 },
  active: true,
  last_crawled_at: null,
  added_by: null,
  created_at: "2026-07-01T00:00:00Z",
};

const BOARDS: BoardForMatch[] = [
  { id: "b-vapor", brandName: "Aqua Marina", modelName: "Vapor", modelYear: 2024, inflatable: null },
];

function productPage(name: string, brand: string, price: string): string {
  return `<html><head><script type="application/ld+json">
    {"@type":"Product","name":${JSON.stringify(name)},
     "brand":{"@type":"Brand","name":${JSON.stringify(brand)}},
     "offers":{"@type":"Offer","price":${JSON.stringify(price)},"priceCurrency":"HUF",
               "availability":"https://schema.org/InStock"}}
  </script></head><body><table><tr><td>Teherbírás</td><td>140 kg</td></tr></table></body></html>`;
}

const SITEMAP = `<urlset>
  <url><loc>${ORIGIN}/termek/aqua-marina-vapor</loc></url>
  <url><loc>${ORIGIN}/termek/gladiator-origin</loc></url>
  <url><loc>${ORIGIN}/blog/sup-kezdoknek</loc></url>
</urlset>`;

/** Rögzítő store: minden írási szándékot eltesz, semmit nem hív ki. */
function makeStore(boards: BoardForMatch[] = BOARDS) {
  const prices: { boardId: string; priceHuf: number }[] = [];
  const seen: { boardId: string; inStock: boolean | null }[] = [];
  const candidates: CandidateInput[] = [];
  /** MINDEN saveCandidate hívás — a csak-frissítő is (`refreshOnly`). */
  const savedInputs: CandidateInput[] = [];
  const crawled: string[] = [];
  const store: CrawlStore = {
    listBoardsForMatch: async () => boards,
    recordPrice: async (input) => {
      prices.push({ boardId: input.boardId, priceHuf: input.priceHuf });
    },
    markBoardSeen: async (input) => {
      seen.push({ boardId: input.boardId, inStock: input.inStock });
    },
    saveCandidate: async (input) => {
      savedInputs.push(input);
      // A `refreshOnly` hívás a MEGLÉVŐ jelöltet frissítené — ez a hamis
      // tároló üresen indul, tehát ott nincs mit frissíteni. Ugyanaz a
      // szemantika, mint az éles tárolóban: újat NEM hoz létre.
      if (input.refreshOnly) return false;
      candidates.push(input);
      return true;
    },
    markSourceCrawled: async (sourceId) => {
      crawled.push(sourceId);
    },
  };
  return { store, prices, seen, candidates, crawled, savedInputs };
}

/** Hálózat-imitáció URL→(status, text) térképpel; a lekért URL-eket rögzíti. */
function makeNetwork(map: Record<string, { status?: number; text?: string }>) {
  const requested: string[] = [];
  const fetchText = async (url: string) => {
    requested.push(url);
    const entry = map[url];
    if (!entry) return { status: 404, text: "" };
    return { status: entry.status ?? 200, text: entry.text ?? "" };
  };
  return { fetchText, requested };
}

const HAPPY_NETWORK = {
  [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\nDisallow: /kosar\n" },
  [`${ORIGIN}/sitemap.xml`]: { text: SITEMAP },
  [`${ORIGIN}/termek/aqua-marina-vapor`]: {
    text: productPage(`Aqua Marina Vapor 10'4" 2024`, "Aqua Marina", "189000"),
  },
  [`${ORIGIN}/termek/gladiator-origin`]: {
    text: productPage("Gladiator Origin Pro 12'6", "Gladiator", "249000"),
  },
};

describe("crawlSource — teljes menet", () => {
  it("ismert deszkára árat ír, ismeretlenre jelöltet készít", async () => {
    const network = makeNetwork(HAPPY_NETWORK);
    const { store, prices, seen, candidates, crawled, savedInputs } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });

    expect(summary.urlsConsidered).toBe(2); // a blog kiesett a minta miatt
    expect(summary.productsExtracted).toBe(2);
    expect(summary.matchedKnown).toBe(1);
    expect(summary.candidatesCreated).toBe(1);
    expect(summary.errors).toEqual([]);

    expect(prices).toEqual([{ boardId: "b-vapor", priceHuf: 189000 }]);
    expect(seen).toEqual([{ boardId: "b-vapor", inStock: true }]);
    expect(candidates[0]?.extracted.modelName).toBe("Origin Pro");
    expect(candidates[0]?.extracted.specs.maxLoadKg).toBe(140);
    expect(crawled).toEqual(["src-1"]);
    // Az ISMERT deszkára is megy `saveCandidate` hívás, de CSAK FRISSÍTÉSKÉNT
    // (F2.1-utó-39). Enélkül egy régi, még elbírálatlan jelölt örökre a régi
    // adatával marad a moderátor előtt, hiába javítottuk azóta a kinyerést —
    // élesben ez a 210 cm-es ATLAS-t és 27 Gladiator-jelöltet érintette.
    expect(savedInputs.filter((input) => input.refreshOnly)).toHaveLength(1);
    expect(savedInputs.find((input) => input.refreshOnly)?.matchedBoardId).toBe("b-vapor");
  });

  it("a blog-URL-t meg sem kéri (udvarias crawl)", async () => {
    const network = makeNetwork(HAPPY_NETWORK);
    const { store } = makeStore();
    await crawlSource(SOURCE, { fetchText: network.fetchText, store });
    expect(network.requested).not.toContain(`${ORIGIN}/blog/sup-kezdoknek`);
  });

  it("a robots.txt által tiltott utat nem kéri le", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\nDisallow: /termek/gladiator" },
    });
    const { store, candidates } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });

    expect(summary.robotsBlocked).toBe(1);
    expect(candidates).toEqual([]);
    expect(network.requested).not.toContain(`${ORIGIN}/termek/gladiator-origin`);
  });

  it("elérhetetlen robots.txt → a forrás KIMARAD (nem találgatunk)", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/robots.txt`]: { status: 503 },
    });
    const { store } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });

    expect(summary.errors[0]).toMatch(/robots\.txt/);
    expect(summary.productsExtracted).toBe(0);
    expect(network.requested).toEqual([`${ORIGIN}/robots.txt`]);
  });

  it("hiányzó robots.txt (404) esetén viszont crawl-ozunk (szabvány)", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/robots.txt`]: { status: 404 },
    });
    const { store } = makeStore();
    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });
    expect(summary.productsExtracted).toBe(2);
  });

  it("követi a sitemap-indexet és a robots Sitemap-direktíváját", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/robots.txt`]: {
        text: `User-agent: *\nSitemap: ${ORIGIN}/sitemap-termek.xml`,
      },
      [`${ORIGIN}/sitemap-termek.xml`]: {
        text: `<sitemapindex><sitemap><loc>${ORIGIN}/sm-1.xml</loc></sitemap></sitemapindex>`,
      },
      [`${ORIGIN}/sm-1.xml`]: { text: SITEMAP },
    });
    const { store } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });
    expect(summary.productsExtracted).toBe(2);
  });

  it("egy termékoldal hibája nem viszi el a többit", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/termek/gladiator-origin`]: { status: 500 },
    });
    const { store, prices } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });

    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatch(/HTTP 500/);
    expect(prices).toHaveLength(1); // az ismert deszka ára attól még megvan
  });

  it("KIEGÉSZÍTŐBŐL nem csinál jelöltet (a moderációs sor deszkákról szól)", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/termek/gladiator-origin`]: {
        // Élesben mért eset: a SUP-bolt sitemapjében napszemüveg is szerepel.
        text: `<html><head><script type="application/ld+json">
          {"@type":"Product","name":"Jobe DIM napszemüveg Tortoise",
           "brand":{"@type":"Brand","name":"Jobe"},
           "offers":{"@type":"Offer","price":"19900","priceCurrency":"HUF"}}
        </script></head><body></body></html>`,
      },
    });
    const { store, candidates } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });

    expect(summary.productsExtracted).toBe(2);
    expect(summary.skippedNonBoard).toBe(1);
    expect(summary.candidatesCreated).toBe(0);
    expect(candidates).toEqual([]);
  });

  it("KÖVETETT felszerelést (evező) jelöltnek ment, accessoryType-tal (F2.3 3. szakasz)", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/termek/gladiator-origin`]: {
        text: `<html><head><script type="application/ld+json">
          {"@type":"Product","name":"Karbon SUP evező állítható 170-220 cm",
           "brand":{"@type":"Brand","name":"Jobe"},
           "offers":{"@type":"Offer","price":"29900","priceCurrency":"HUF"}}
        </script></head><body></body></html>`,
      },
    });
    const { store, candidates } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });

    expect(summary.skippedNonBoard).toBe(0);
    expect(summary.candidatesCreated).toBe(1);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.extracted.accessoryType).toBe("evezo");
  });

  it("nem KÖVETETT felszerelést (táska) sem jelöltnek, sem deszkának nem vesz — csak skippedNonBoard", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/termek/gladiator-origin`]: {
        text: `<html><head><script type="application/ld+json">
          {"@type":"Product","name":"Vízhatlan SUP táska 20 l",
           "brand":{"@type":"Brand","name":"Jobe"},
           "offers":{"@type":"Offer","price":"12900","priceCurrency":"HUF"}}
        </script></head><body></body></html>`,
      },
    });
    const { store, candidates } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });

    expect(summary.skippedNonBoard).toBe(1);
    expect(summary.candidatesCreated).toBe(0);
    expect(candidates).toEqual([]);
  });

  it("JSON-LD nélküli oldalt csendben átugorja", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/termek/gladiator-origin`]: { text: "<html><body>nincs itt semmi</body></html>" },
    });
    const { store, candidates } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });

    expect(summary.productsExtracted).toBe(1);
    expect(summary.errors).toEqual([]);
    expect(candidates).toEqual([]);
  });

  it("a robots Crawl-delay-e felülírja a konfigurált szünetet", async () => {
    const network = makeNetwork({
      ...HAPPY_NETWORK,
      [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\nCrawl-delay: 3" },
    });
    const { store } = makeStore();
    const delays: number[] = [];

    await crawlSource(SOURCE, {
      fetchText: network.fetchText,
      store,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    expect(delays).toEqual([3000, 3000]);
  });

  it("base_url nélküli forrás hibát ad, nem dob", async () => {
    const network = makeNetwork({});
    const { store } = makeStore();
    const summary = await crawlSource(
      { ...SOURCE, base_url: null },
      { fetchText: network.fetchText, store },
    );
    expect(summary.errors).toEqual(["nincs base_url"]);
  });
});

describe("crawlSource — böngésző-renderelt fallback (F2.1-utó-3)", () => {
  /**
   * Cím MÉRET-JELÖLÉS nélkül (nincs "12'6" jellegű minta a title-fallbacknek),
   * de a "SUP Board" szó garantálja a deszka-besorolást a `classifyProduct`
   * kulcsszó-ágán, FÜGGETLENÜL attól, hogy a fallback sikerül-e — így a
   * teszt kifejezetten a fallback-viselkedésre koncentrálhat.
   */
  function productPageNoDimensions(name: string, brand: string, price: string): string {
    return `<html><head><script type="application/ld+json">
      {"@type":"Product","name":${JSON.stringify(name)},
       "brand":{"@type":"Brand","name":${JSON.stringify(brand)}},
       "offers":{"@type":"Offer","price":${JSON.stringify(price)},"priceCurrency":"HUF"}}
    </script></head><body></body></html>`;
  }

  const NO_DIM_NETWORK = {
    ...HAPPY_NETWORK,
    [`${ORIGIN}/termek/gladiator-origin`]: {
      text: productPageNoDimensions("Gladiator Origin Pro SUP Board", "Gladiator", "249000"),
    },
  };

  it("lefut, ha mindhárom méret hiányzik a sima HTML-ből, és a jelölt frissül", async () => {
    const network = makeNetwork(NO_DIM_NETWORK);
    const { store, candidates } = makeStore();
    const renderCalls: string[] = [];

    await crawlSource(SOURCE, {
      fetchText: network.fetchText,
      store,
      renderText: async (url) => {
        renderCalls.push(url);
        return "Dimensions: 320 x 80 x 15cm";
      },
    });

    expect(renderCalls).toEqual([`${ORIGIN}/termek/gladiator-origin`]);
    expect(candidates[0]?.extracted.specs).toMatchObject({
      lengthCm: 320,
      widthCm: 80,
      thicknessCm: 15,
    });
  });

  it("NEM fut, ha legalább egy méret már megvan a sima HTML-ből", async () => {
    // A HAPPY_NETWORK gladiator-oldalának címe "12'6" — a title-fallback ebből
    // már kitölti a hosszt, tehát a MINDHÁROM-hiányzik feltétel nem teljesül.
    const network = makeNetwork(HAPPY_NETWORK);
    const { store } = makeStore();
    let called = false;

    await crawlSource(SOURCE, {
      fetchText: network.fetchText,
      store,
      renderText: async () => {
        called = true;
        return "Dimensions: 999 x 999 x 999cm";
      },
    });

    expect(called).toBe(false);
  });

  it("a fallback null-eredménye (renderelési hiba) nem dönti el a crawlot", async () => {
    const network = makeNetwork(NO_DIM_NETWORK);
    const { store, candidates } = makeStore();

    const summary = await crawlSource(SOURCE, {
      fetchText: network.fetchText,
      store,
      renderText: async () => null,
    });

    expect(summary.errors).toEqual([]);
    expect(candidates[0]?.extracted.specs.lengthCm).toBeNull();
  });

  it("deps.renderText hiányában is végigfut, fallback nélkül (visszafelé kompatibilis)", async () => {
    const network = makeNetwork(NO_DIM_NETWORK);
    const { store, candidates } = makeStore();

    const summary = await crawlSource(SOURCE, { fetchText: network.fetchText, store });

    expect(summary.errors).toEqual([]);
    expect(candidates[0]?.extracted.specs.lengthCm).toBeNull();
  });
});

describe("crawlAll", () => {
  it("kihagyja az inaktív forrásokat, és összegzést ad", async () => {
    const network = makeNetwork(HAPPY_NETWORK);
    const { store, crawled } = makeStore();

    const summary = await crawlAll(
      [SOURCE, { ...SOURCE, id: "src-2", name: "Inaktív", active: false }],
      { fetchText: network.fetchText, store },
      { dryRun: true },
    );

    expect(summary.sources).toHaveLength(1);
    expect(summary.dryRun).toBe(true);
    expect(crawled).toEqual(["src-1"]);
  });

  it("egy forrás váratlan hibája nem viszi el a futást", async () => {
    const { store } = makeStore();
    const summary = await crawlAll([SOURCE], {
      fetchText: async () => {
        throw new Error("hálózat leállt");
      },
      store,
    });
    expect(summary.sources[0]?.errors[0]).toMatch(/robots\.txt/);
  });
});

/**
 * SHOPIFY-ÁG (F2.1-utó-14) — a `/products.json`-ról dolgozó forrás.
 * A minta a star-board.com valós válaszának szerkezetét követi.
 */
describe("crawlSource — Shopify-forrás", () => {
  const SHOPIFY_SOURCE: CatalogSourceRow = {
    ...SOURCE,
    id: "src-shopify",
    name: "Gyártói Shopify",
    kind: "brand_site",
    crawl_config: {
      minDelayMs: 0,
      shopify: { productTypes: ["SUP Hardboard"] },
    },
  };

  function catalogPage(products: unknown[]): string {
    return JSON.stringify({ products });
  }

  const GO = {
    id: 1,
    title: "GO Paddle Board",
    handle: "go-paddle-board",
    vendor: "Starboard SUP",
    product_type: "SUP Hardboard",
    variants: [
      { id: 10, title: `12'0" X 34" / Rhino`, available: true },
      { id: 11, title: `11'2" X 32" / Rhino`, available: true },
    ],
  };
  const TSHIRT = {
    id: 2,
    title: "Starboard Póló",
    handle: "polo",
    vendor: "Starboard",
    product_type: "T-Shirt",
    variants: [{ id: 20, title: "M" }],
  };

  it("a /products.json-ból méretenként külön jelöltet ír, sitemap nélkül", async () => {
    const { store, candidates } = makeStore([]);
    const network = makeNetwork({
      [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\n" },
      [`${ORIGIN}/products.json?limit=250&page=1`]: { text: catalogPage([GO, TSHIRT]) },
    });

    const summary = await crawlSource(SHOPIFY_SOURCE, {
      fetchText: network.fetchText,
      store,
    });

    // Két méret → két jelölt; a póló a productTypes szűrőn fennakadt.
    expect(candidates).toHaveLength(2);
    expect(summary.candidatesCreated).toBe(2);
    // Sitemapet EGYÁLTALÁN nem kért le.
    expect(network.requested.some((u) => u.includes("sitemap"))).toBe(false);
  });

  it("a hivatalos gyártói nevet és a méretet írja a modellnévbe, ár nélkül", async () => {
    const { store, candidates } = makeStore([]);
    const network = makeNetwork({
      [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\n" },
      [`${ORIGIN}/products.json?limit=250&page=1`]: { text: catalogPage([GO]) },
    });

    await crawlSource(SHOPIFY_SOURCE, { fetchText: network.fetchText, store });

    for (const candidate of candidates) {
      expect(candidate.extracted.brandName).toBe("Starboard");
      expect(candidate.extracted.modelName).toContain("GO");
      expect(candidate.extracted.priceHuf).toBeNull();
      expect(candidate.url).toContain("?variant=");
    }
    const lengths = candidates.map((c) => c.extracted.specs.lengthCm);
    expect(lengths.every((l) => l !== null)).toBe(true);
  });

  it("a robots.txt tiltása esetén NEM kéri le a katalógust", async () => {
    const { store, candidates } = makeStore([]);
    const network = makeNetwork({
      [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\nDisallow: /products.json\n" },
      [`${ORIGIN}/products.json?limit=250&page=1`]: { text: catalogPage([GO]) },
    });

    const summary = await crawlSource(SHOPIFY_SOURCE, { fetchText: network.fetchText, store });

    expect(candidates).toHaveLength(0);
    expect(summary.robotsBlocked).toBe(1);
    expect(network.requested.some((u) => u.includes("products.json"))).toBe(false);
  });

  it("ismert deszkát nem duplikál jelöltként, hanem látottnak jelöl", async () => {
    // A `cleanModelName` a generikus „Paddle Board" utótagot levágja, a méret
    // és a KIVITEL viszont a névbe kerül — így él a katalógusban is.
    const { store, candidates, seen } = makeStore([
      {
        id: "b-go",
        brandName: "Starboard",
        modelName: `GO 12'0" X 34" Rhino`,
        modelYear: null,
        inflatable: null,
      },
    ]);
    const network = makeNetwork({
      [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\n" },
      [`${ORIGIN}/products.json?limit=250&page=1`]: { text: catalogPage([GO]) },
    });

    await crawlSource(SHOPIFY_SOURCE, { fetchText: network.fetchText, store });

    expect(seen.map((s) => s.boardId)).toContain("b-go");
    expect(candidates.every((c) => !c.extracted.modelName.includes(`12'0"`))).toBe(true);
  });

  it("a katalógus HTTP-hibáját jelenti, de nem dob", async () => {
    const { store } = makeStore([]);
    const network = makeNetwork({
      [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\n" },
      [`${ORIGIN}/products.json?limit=250&page=1`]: { status: 503 },
    });

    const summary = await crawlSource(SHOPIFY_SOURCE, { fetchText: network.fetchText, store });

    expect(summary.errors.some((e) => e.includes("503"))).toBe(true);
    expect(summary.candidatesCreated).toBe(0);
  });
});

/**
 * KIZÁRT KOLLEKCIÓK (F2.1-utó-20). Felhasználói döntés (2026-08-19): „a surf
 * egy teljesen más dolog, mi a SUP-okra fókuszálunk". A gyártó szörf/wing
 * kollekcióinak termékei ki sem kerülnek jelölt-sorba — DE az ÁTFEDŐ modellek
 * (Whopper, GO Surf: „all-round / wave" ÉS „surf" is) bent maradnak.
 */
describe("crawlSource — Shopify kizárt kollekciók", () => {
  const SOURCE_EXCL: CatalogSourceRow = {
    ...SOURCE,
    id: "src-excl",
    name: "Gyártó",
    kind: "brand_site",
    crawl_config: {
      minDelayMs: 0,
      shopify: {
        collectionTypes: { allround: "allround" },
        excludeCollections: ["surf"],
      },
    },
  };

  function product(id: number, title: string) {
    return {
      id,
      title,
      handle: title.toLowerCase().replace(/\s+/g, "-"),
      vendor: "Starboard SUP",
      product_type: "SUP Hardboard",
      variants: [{ id: id * 10, title: `10'0" X 32"` }],
    };
  }

  it("a CSAK szörf-kollekciós terméket kihagyja", async () => {
    const { store, candidates } = makeStore([]);
    const network = makeNetwork({
      [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\n" },
      [`${ORIGIN}/products.json?limit=250&page=1`]: {
        text: JSON.stringify({ products: [product(1, "Spice"), product(2, "GO")] }),
      },
      [`${ORIGIN}/collections/allround/products.json?limit=250`]: {
        text: JSON.stringify({ products: [{ id: 2 }] }),
      },
      [`${ORIGIN}/collections/surf/products.json?limit=250`]: {
        text: JSON.stringify({ products: [{ id: 1 }] }),
      },
    });

    await crawlSource(SOURCE_EXCL, { fetchText: network.fetchText, store });

    const names = candidates.map((c) => c.extracted.modelName);
    expect(names.some((n) => n.includes("Spice"))).toBe(false);
    expect(names.some((n) => n.includes("GO"))).toBe(true);
  });

  it("az ÁTFEDŐ terméket (all-round ÉS surf) MEGTARTJA", async () => {
    const { store, candidates } = makeStore([]);
    const network = makeNetwork({
      [`${ORIGIN}/robots.txt`]: { text: "User-agent: *\n" },
      [`${ORIGIN}/products.json?limit=250&page=1`]: {
        text: JSON.stringify({ products: [product(3, "Whopper")] }),
      },
      // A Whopper MINDKÉT kollekcióban benne van.
      [`${ORIGIN}/collections/allround/products.json?limit=250`]: {
        text: JSON.stringify({ products: [{ id: 3 }] }),
      },
      [`${ORIGIN}/collections/surf/products.json?limit=250`]: {
        text: JSON.stringify({ products: [{ id: 3 }] }),
      },
    });

    await crawlSource(SOURCE_EXCL, { fetchText: network.fetchText, store });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.extracted.modelName).toContain("Whopper");
    expect(candidates[0]?.extracted.boardType).toBe("allround");
  });
});

describe("crawlSource — SOROZAT-SZINTŰ leírás (seriesTextByUrl)", () => {
  /**
   * A gyártó a specifikációt a SOROZATRA írja le, nem a termékre — élesben
   * (rocoutdoors.com) a teherbírás a termékoldalon SEHOL nem áll. A
   * termékoldal itt szándékosan csak a méretet adja.
   */
  const SERIES_ORIGIN = "https://gyarto.com";
  const SERIES_SOURCE: CatalogSourceRow = {
    ...SOURCE,
    base_url: SERIES_ORIGIN,
    crawl_config: {
      htmlOnly: true,
      minDelayMs: 0,
      productUrlPatterns: ["/products/"],
      defaultBrandName: "ROC",
      seriesTextByUrl: {
        "/products/": `${SERIES_ORIGIN}/collections/explorer-series.json`,
      },
    },
  };

  function seriesNetwork() {
    const page = (title: string) =>
      `<html><head><title>${title}</title></head><body>` +
      `<p>At 10' tall, 32" wide, and 6" thick, built tough.</p>` +
      `<p>This inflatable board packs into a backpack.</p></body></html>`;
    return makeNetwork({
      [`${SERIES_ORIGIN}/robots.txt`]: { text: "User-agent: *\n" },
      [`${SERIES_ORIGIN}/sitemap.xml`]: {
        text: `<urlset>
          <url><loc>${SERIES_ORIGIN}/products/explorer</loc></url>
          <url><loc>${SERIES_ORIGIN}/products/explorer-green</loc></url>
        </urlset>`,
      },
      [`${SERIES_ORIGIN}/products/explorer`]: { text: page("Explorer") },
      [`${SERIES_ORIGIN}/products/explorer-green`]: { text: page("Explorer Green") },
      [`${SERIES_ORIGIN}/collections/explorer-series.json`]: {
        text: JSON.stringify({
          collection: {
            description: "<p>These boards have a weight capacity of 350 pounds.</p>",
          },
        }),
      },
    });
  }

  it("a sorozat leírásából pótolja a termékoldalon HIÁNYZÓ teherbírást", async () => {
    const network = seriesNetwork();
    const { store, candidates } = makeStore([]);

    await crawlSource(SERIES_SOURCE, { fetchText: network.fetchText, store });

    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      // A méret a termékoldalról, a teherbírás a sorozat leírásából.
      expect(candidate.extracted.specs.lengthCm).toBe(304.8);
      expect(candidate.extracted.specs.maxLoadKg).toBe(158.8);
    }
  });

  it("egy sorozat leírását EGYSZER tölti le, akárhány terméke van", async () => {
    // A színváltozatok mind ugyanarra a kollekcióra mutatnak — gyorstár
    // nélkül a bejárás minden terméknél újra lekérné ugyanazt.
    const network = seriesNetwork();
    const { store } = makeStore([]);

    await crawlSource(SERIES_SOURCE, { fetchText: network.fetchText, store });

    const seriesCalls = network.requested.filter((url) =>
      url.includes("/collections/explorer-series.json"),
    );
    expect(seriesCalls).toHaveLength(1);
  });

  it("elérhetetlen sorozat-leírás NEM viszi el a termék kinyerését", async () => {
    const network = makeNetwork({
      [`${SERIES_ORIGIN}/robots.txt`]: { text: "User-agent: *\n" },
      [`${SERIES_ORIGIN}/sitemap.xml`]: {
        text: `<urlset><url><loc>${SERIES_ORIGIN}/products/explorer</loc></url></urlset>`,
      },
      [`${SERIES_ORIGIN}/products/explorer`]: {
        text:
          `<html><head><title>Explorer</title></head><body>` +
          `<p>At 10' tall, 32" wide, and 6" thick, built tough.</p>` +
          `<p>This inflatable board packs into a backpack.</p></body></html>`,
      },
      // A kollekció-JSON hiányzik → 404.
    });
    const { store, candidates } = makeStore([]);

    const summary = await crawlSource(SERIES_SOURCE, {
      fetchText: network.fetchText,
      store,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.extracted.specs.lengthCm).toBe(304.8);
    expect(candidates[0]?.extracted.specs.maxLoadKg).toBeNull();
    // A hiba nem néma: a summary megmondja, MIÉRT üres a mező.
    expect(summary.errors.join(" ")).toContain("sorozat-leírás HTTP 404");
  });
});

/**
 * A GYÁRTÓ MÉRT ADATA AZ ERŐSEBB (felhasználói döntés, 2026-09-20).
 *
 * A Shopify variáns-CÍME névleges méretet ad (`9'6"` → 289,6 cm), a gyártó
 * spec-táblája a ténylegesen mértet (297,2 cm). 94 Starboard-termékoldalon
 * mérve 109 jelölt hossza és 119 szélessége tért el a gyártó saját adatától.
 */
describe("applySpecTable — a gyártói tábla üti a variáns-címet", () => {
  const product: ExtractedProduct = {
    sourceUrl: "https://star-board.com/products/2024-go-surf-paddle-board?variant=1",
    brandName: "Starboard",
    modelName: `GO Surf 9'6" X 31" Lite Tech`,
    rawTitle: `2024 GO Surf Paddle Board 9'6" X 31" Lite Tech`,
    modelYear: 2024,
    priceHuf: null,
    inStock: true,
    imageUrl: null,
    boardType: "allround",
    // A variáns CÍMÉBŐL: névleges 9'6" = 289,6 cm.
    specs: { ...EMPTY_SPECS, lengthCm: 289.6, widthCm: 78.7 },
    accessoryType: null,
  };

  it("felülírja a névleges méretet a gyártó mért értékével", () => {
    const table = new Map([
      ["9'6x31", { ...EMPTY_SPECS, lengthCm: 297.2, widthCm: 79.1, maxLoadKg: 120 }],
    ]);
    const result = applySpecTable(product, `9'6" X 31"`, table);
    expect(result.specs.lengthCm).toBe(297.2);
    expect(result.specs.widthCm).toBe(79.1);
    expect(result.specs.maxLoadKg).toBe(120);
  });

  it("ahol a tábla HALLGAT, ott a jelölt adata marad", () => {
    const table = new Map([["9'6x31", { ...EMPTY_SPECS, maxLoadKg: 120 }]]);
    const result = applySpecTable(product, `9'6" X 31"`, table);
    expect(result.specs.lengthCm).toBe(289.6);
    expect(result.specs.widthCm).toBe(78.7);
    expect(result.specs.maxLoadKg).toBe(120);
  });

  it("nem illeszkedő mérethez nem nyúl", () => {
    const table = new Map([["10'0x34", { ...EMPTY_SPECS, lengthCm: 304.8 }]]);
    expect(applySpecTable(product, `9'6" X 31"`, table).specs.lengthCm).toBe(289.6);
  });
});
