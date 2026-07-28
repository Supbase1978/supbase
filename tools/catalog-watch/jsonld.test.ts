import { describe, expect, it } from "vitest";

import { extractJsonLdBlocks, findProductNodes, pickPrimaryProduct } from "./jsonld.ts";

/** Tipikus webshop-termékoldal: BreadcrumbList + Product egy `@graph`-ban. */
const SHOP_PAGE = `<!doctype html>
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"BreadcrumbList","itemListElement":[]},
  {"@type":"Product","name":"Aqua Marina Vapor 10'4\\"","brand":{"@type":"Brand","name":"Aqua Marina"},
   "offers":{"@type":"Offer","price":"189000","priceCurrency":"HUF","availability":"https://schema.org/InStock"}}
]}
</script>
<script type='application/ld+json'>{"@type":"Organization","name":"Bolt Kft."}</script>
</head><body></body></html>`;

describe("extractJsonLdBlocks", () => {
  it("attribútum-sorrendtől és idézőjeltől függetlenül megtalálja a blokkokat", () => {
    expect(extractJsonLdBlocks(SHOP_PAGE)).toHaveLength(2);
  });

  it("JSON-LD nélküli oldalon üres lista", () => {
    expect(extractJsonLdBlocks("<html><body>semmi</body></html>")).toEqual([]);
  });
});

describe("findProductNodes", () => {
  it("kibontja a Productot a @graph-ból", () => {
    const products = findProductNodes(SHOP_PAGE);
    expect(products).toHaveLength(1);
    expect(products[0]?.name).toBe(`Aqua Marina Vapor 10'4"`);
  });

  it("a ProductGroup is termék (méret-variánsos boltok)", () => {
    const html = `<script type="application/ld+json">{"@type":["ProductGroup","Thing"],"name":"Ride"}</script>`;
    expect(findProductNodes(html)).toHaveLength(1);
  });

  it("egy hibás JSON-LD blokk nem viszi el a többit", () => {
    const html = `
      <script type="application/ld+json">{ ez nem json }</script>
      <script type="application/ld+json">{"@type":"Product","name":"Vapor"}</script>`;
    expect(findProductNodes(html)).toHaveLength(1);
  });

  it("nem-termék oldalon üres lista", () => {
    const html = `<script type="application/ld+json">{"@type":"Article","name":"SUP kezdőknek"}</script>`;
    expect(findProductNodes(html)).toEqual([]);
  });
});

describe("pickPrimaryProduct", () => {
  it("a nevesített, áras terméket választja az ajánló-blokk helyett", () => {
    const nodes = [
      { "@type": "Product", name: "Ajánlott: evező" },
      {
        "@type": "Product",
        name: "Vapor 10'4\"",
        brand: "Aqua Marina",
        offers: { price: "189000" },
      },
    ];
    expect(pickPrimaryProduct(nodes)?.name).toBe(`Vapor 10'4"`);
  });

  it("üres listára null", () => {
    expect(pickPrimaryProduct([])).toBeNull();
  });
});
