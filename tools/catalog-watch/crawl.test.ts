import { describe, expect, it } from "vitest";

import { crawlAll, crawlSource, type CandidateInput, type CrawlStore } from "./crawl.ts";
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
  { id: "b-vapor", brandName: "Aqua Marina", modelName: "Vapor", modelYear: 2024 },
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
      candidates.push(input);
      return true;
    },
    markSourceCrawled: async (sourceId) => {
      crawled.push(sourceId);
    },
  };
  return { store, prices, seen, candidates, crawled };
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
    const { store, prices, seen, candidates, crawled } = makeStore();

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
