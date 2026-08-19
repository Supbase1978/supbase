import { describe, expect, it } from "vitest";

import {
  expandShopifyProduct,
  fetchShopifyCatalog,
  parseVariantSize,
  type ShopifyProduct,
} from "./shopify.ts";

/**
 * A minták ÉLESBEN MÉRT star-board.com `/products.json` válaszból valók
 * (2026-08-19) — a göndör idézőjelek, a `|` űrtartalom-szegmens és a
 * konstrukció-utótag mind valódi, előforduló alakok.
 */
describe("parseVariantSize", () => {
  it("kiolvassa a hosszt és a szélességet az ASCII alakból", () => {
    expect(parseVariantSize(`12'0" X 34" / Rhino`)).toMatchObject({
      lengthCm: 365.8,
      widthCm: 86.4,
      volumeL: null,
    });
  });

  it("kiolvassa az űrtartalmat a `|` szegmensből", () => {
    const size = parseVariantSize(`9'8" X 30.5" | 145 L / Carbon Reflex`);
    expect(size).toMatchObject({ volumeL: 145 });
    expect(size?.lengthCm).toBeCloseTo(294.6, 1);
    expect(size?.widthCm).toBeCloseTo(77.5, 1);
  });

  it("a göndör idézőjeleket is kezeli (ugyanaz a bolt vegyesen használja)", () => {
    const curly = parseVariantSize(`14’0” X 28.5” / Xtec Carbon D2`);
    const ascii = parseVariantSize(`14'0" X 28.5" / Xtec Carbon D2`);
    expect(curly).toEqual(ascii);
    expect(curly?.lengthCm).toBeCloseTo(426.7, 1);
  });

  it("a címke CSAK a dimenzió — az űrtartalom a specs-be megy, nem a névbe", () => {
    // Élesben mért csúnyaság: enélkül a modellnév „TallTwin 9'8\" X 30.5\" | 145 L".
    expect(parseVariantSize(`9'8" X 30.5" | 145 L / Carbon Reflex`)?.label).toBe(`9'8" X 30.5"`);
    // A nem-űrtartalom utótag (kivitel-név) sem szivárog a címkébe.
    expect(parseVariantSize(`18'6" X 60" | Starship All Water`)?.label).toBe(`18'6" X 60"`);
  });

  it("azonos dimenzió KÜLÖNBÖZŐ űrtartalommal két külön méret marad", () => {
    const a = parseVariantSize(`9'0" X 27.5" | 108 L / Carbon`);
    const b = parseVariantSize(`9'0" X 27.5" | 94 L / Carbon`);
    expect(a?.label).toBe(b?.label);
    expect(a?.volumeL).not.toBe(b?.volumeL);
  });

  it("a `Default Title` és az üres cím nem méret", () => {
    expect(parseVariantSize("Default Title")).toBeNull();
    expect(parseVariantSize("")).toBeNull();
    expect(parseVariantSize(null)).toBeNull();
  });

  it("a nem méret jellegű variáns (szín, méretkód) nem ad hamis méretet", () => {
    expect(parseVariantSize("Blue")).toBeNull();
    expect(parseVariantSize("XL")).toBeNull();
  });
});

const GO_BOARD: ShopifyProduct = {
  id: 8986913145127,
  title: "GO Paddle Board",
  handle: "2024-go-paddle-board",
  vendor: "Starboard SUP",
  product_type: "SUP Hardboard",
  body_html: "<p>The perfect introductory paddle board for first time paddlers.</p>",
  images: [{ src: "//star-board.com/cdn/shop/files/go.jpg" }],
  variants: [
    { id: 47603090522407, title: `12'0" X 34" / Rhino`, available: true },
    { id: 47603090325799, title: `11'2" X 32" / Lite Tech Wave`, available: true },
    { id: 47603090000000, title: `11'2" X 32" / Rhino`, available: false },
  ],
};

describe("expandShopifyProduct", () => {
  it("méretenként EGY jelöltet ad, a konstrukciós változatokat összefésüli", () => {
    const products = expandShopifyProduct(GO_BOARD, "https://star-board.com");
    // 3 variáns, de csak 2 KÜLÖNBÖZŐ méret (11'2"x32" kétszer szerepel).
    expect(products).toHaveLength(2);
    const sizes = products.map((p) => p.modelName).sort();
    expect(sizes[0]).toContain(`11'2"`);
    expect(sizes[1]).toContain(`12'0"`);
  });

  it("a méret a modellnév része lesz (a Shopify terméknév méret nélküli)", () => {
    const products = expandShopifyProduct(GO_BOARD, "https://star-board.com");
    for (const product of products) {
      expect(product.modelName).toMatch(/GO/);
      expect(product.modelName).toMatch(/X/);
    }
  });

  it("méretenként KÜLÖN, stabil URL-t ad (a jelölt egyediség-kulcsa)", () => {
    const first = expandShopifyProduct(GO_BOARD, "https://star-board.com");
    const second = expandShopifyProduct(GO_BOARD, "https://star-board.com");
    const urls = first.map((p) => p.sourceUrl);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(url).toContain("?variant=");
    // Ismételt futás ugyanazt az URL-t adja — különben minden crawl duplikálna.
    expect(second.map((p) => p.sourceUrl)).toEqual(urls);
  });

  it("azonos méret két konstrukciójából a KISEBB variáns-id URL-je marad (stabil)", () => {
    const products = expandShopifyProduct(GO_BOARD, "https://star-board.com");
    const short = products.find((p) => p.modelName.includes(`11'2"`));
    // 47603090000000 < 47603090325799 → a Rhino példány nyer.
    expect(short?.sourceUrl).toContain("variant=47603090000000");
  });

  it("a gyártói `vendor` adja a márkanevet, és beírja a méreteket", () => {
    const products = expandShopifyProduct(GO_BOARD, "https://star-board.com");
    const long = products.find((p) => p.modelName.includes(`12'0"`));
    expect(long?.brandName).toBe("Starboard");
    expect(long?.specs.lengthCm).toBeCloseTo(365.8, 1);
    expect(long?.specs.widthCm).toBeCloseTo(86.4, 1);
  });

  it("ÁRAT SOHA nem ad (gyártói forrás + ár-megjelenítési politika)", () => {
    const products = expandShopifyProduct(GO_BOARD, "https://star-board.com");
    for (const product of products) expect(product.priceHuf).toBeNull();
  });

  it("a nem-deszka terméket (táska) kiszűri a közös classifyProduct kapu", () => {
    const bag: ShopifyProduct = {
      id: 1,
      title: "SUP Wheel Travel Paddle Soft Bag",
      handle: "sup-travel-bag",
      vendor: "Starboard",
      product_type: "SUP Bag",
      variants: [{ id: 11, title: "Default Title" }],
    };
    const products = expandShopifyProduct(bag, "https://star-board.com");
    expect(products.every((p) => p.accessoryType !== null || p.specs.lengthCm === null)).toBe(true);
    // Deszkaként semmiképp nem mehet tovább.
    expect(products.some((p) => p.accessoryType === null && p.specs.lengthCm !== null)).toBe(false);
  });

  it("cím vagy handle nélküli termék nem ad jelöltet", () => {
    expect(expandShopifyProduct({ id: 1, title: "", handle: "x" }, "https://x.com")).toEqual([]);
    expect(expandShopifyProduct({ id: 1, title: "Van neve", handle: "" }, "https://x.com")).toEqual([]);
  });
});

function jsonResponse(products: ShopifyProduct[]): { status: number; text: string } {
  return { status: 200, text: JSON.stringify({ products }) };
}

describe("fetchShopifyCatalog", () => {
  it("lapoz, amíg tele van a lap, és összefűzi az eredményt", async () => {
    const full = Array.from({ length: 250 }, (_, i) => ({
      id: i,
      title: `Board ${i}`,
      handle: `board-${i}`,
      product_type: "SUP Inflatable",
    }));
    const calls: string[] = [];
    const result = await fetchShopifyCatalog(
      "https://shop.example",
      async (url) => {
        calls.push(url);
        return jsonResponse(calls.length === 1 ? full : full.slice(0, 3));
      },
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("page=1");
    expect(result.products).toHaveLength(253);
    expect(result.errors).toEqual([]);
  });

  it("csak a kért `product_type` értékeket engedi át", async () => {
    const mixed: ShopifyProduct[] = [
      { id: 1, title: "Deszka", handle: "a", product_type: "SUP Inflatable" },
      { id: 2, title: "Póló", handle: "b", product_type: "T-Shirt" },
      { id: 3, title: "Kemény deszka", handle: "c", product_type: "SUP Hardboard" },
    ];
    const result = await fetchShopifyCatalog("https://shop.example", async () => jsonResponse(mixed), {
      productTypes: ["sup inflatable", "SUP Hardboard"],
    });
    expect(result.products.map((p) => p.id)).toEqual([1, 3]);
  });

  it("a maxProducts korlátot betartja", async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: i, title: `B${i}`, handle: `b-${i}` }));
    const result = await fetchShopifyCatalog("https://shop.example", async () => jsonResponse(many), {
      maxProducts: 10,
    });
    expect(result.products).toHaveLength(10);
  });

  it("HTTP-hibánál megáll, de a már begyűjtött termékeket visszaadja", async () => {
    let call = 0;
    const full = Array.from({ length: 250 }, (_, i) => ({ id: i, title: `B${i}`, handle: `b-${i}` }));
    const result = await fetchShopifyCatalog("https://shop.example", async () => {
      call += 1;
      return call === 1 ? jsonResponse(full) : { status: 503, text: "" };
    });
    expect(result.products).toHaveLength(250);
    expect(result.errors[0]).toContain("HTTP 503");
  });

  it("érvénytelen JSON-t hibaként jelez, nem dob", async () => {
    const result = await fetchShopifyCatalog("https://shop.example", async () => ({
      status: 200,
      text: "<html>nem json</html>",
    }));
    expect(result.products).toEqual([]);
    expect(result.errors[0]).toContain("érvénytelen JSON");
  });

  it("üres lapnál megáll (nincs végtelen lapozás)", async () => {
    let calls = 0;
    const result = await fetchShopifyCatalog("https://shop.example", async () => {
      calls += 1;
      return jsonResponse([]);
    });
    expect(calls).toBe(1);
    expect(result.products).toEqual([]);
  });
});

describe("expandShopifyProduct — űrtartalom-variánsok", () => {
  it("az azonos dimenziójú, eltérő űrtartalmú variánsokat KÜLÖN jelöltnek hagyja", () => {
    const talltwin: ShopifyProduct = {
      id: 9,
      title: "TallTwin Paddleboard",
      handle: "talltwin",
      vendor: "Starboard SUP",
      product_type: "Paddleboard",
      variants: [
        { id: 90, title: `9'0" X 27.5" | 108 L / Carbon Reflex` },
        { id: 91, title: `9'0" X 27.5" | 94 L / Carbon Reflex` },
        { id: 92, title: `9'0" X 27.5" | 108 L / Xtec Carbon` },
      ],
    };
    const products = expandShopifyProduct(talltwin, "https://star-board.com");
    // 108 L és 94 L = két deszka; a két KIVITEL (Carbon Reflex / Xtec) egy.
    expect(products).toHaveLength(2);
    const volumes = products.map((p) => p.specs.volumeL).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(volumes).toEqual([94, 108]);
    // A név mindkettőnél a tiszta dimenzió — az űrtartalom nem duplázódik bele.
    for (const product of products) {
      expect(product.modelName).toContain(`9'0" X 27.5"`);
      expect(product.modelName).not.toContain("L");
    }
  });
});
