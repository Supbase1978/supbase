import { describe, expect, it } from "vitest";

import {
  displayImageUrl,
  imageFromPage,
  rankImageSources,
  type ImageSourceCandidate,
} from "./images.ts";

const base: ImageSourceCandidate = {
  url: "https://gyarto.com/termek",
  status: "approved",
  sourceKind: "brand_site",
  storedImageUrl: null,
};

describe("rankImageSources", () => {
  /**
   * A `pending` jelölt `matched_board_id`-ját a trigram-egyeztető TIPPELTE.
   * Ha innen vennénk képet, egy „bizonytalan egyezés" MÁS termék fotóját
   * tenné a deszkára — pont az a hiba, ami miatt a hasonlóság-alapú pótlás
   * (`Drift ← Aqua-Marina-Glow.jpeg`) el lett vetve.
   */
  it("csak MODERÁTOR által elbírált kapcsolatot fogad el", () => {
    const ranked = rankImageSources([
      { ...base, status: "pending", url: "https://bolt.hu/a" },
      { ...base, status: "rejected", url: "https://bolt.hu/b" },
      { ...base, status: "approved", url: "https://bolt.hu/c" },
      { ...base, status: "merged", url: "https://bolt.hu/d" },
    ]);
    expect(ranked.map((c) => c.url)).toEqual(["https://bolt.hu/c", "https://bolt.hu/d"]);
  });

  it("a GYÁRTÓI oldal megelőzi a boltit (összevethető renderek)", () => {
    const ranked = rankImageSources([
      { ...base, sourceKind: "feed", url: "https://feed/x" },
      { ...base, sourceKind: "shop", url: "https://bolt.hu/x" },
      { ...base, sourceKind: "brand_site", url: "https://gyarto.com/x" },
    ]);
    expect(ranked.map((c) => c.sourceKind)).toEqual(["brand_site", "shop", "feed"]);
  });

  it("URL nélküli jelölt kimarad (nincs mit letölteni)", () => {
    expect(rankImageSources([{ ...base, url: null }])).toEqual([]);
  });
});

describe("imageFromPage", () => {
  it("a JSON-LD `image`-et veszi elsőként (a forrás SAJÁT állítása)", () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"Coral","image":["https://x.com/coral-jsonld.jpg"]}
      </script>
      <meta property="og:image" content="https://x.com/og.jpg">
      <img src="https://x.com/coral-1.png">
    `;
    expect(imageFromPage(html, "Coral")).toBe("https://x.com/coral-jsonld.jpg");
  });

  it("JSON-LD híján az og:image jön", () => {
    const html = `
      <meta property="og:image" content="https://x.com/og.jpg">
      <img src="https://x.com/coral-1.png">
    `;
    expect(imageFromPage(html, "Coral")).toBe("https://x.com/og.jpg");
  });

  /** Élesben: az aquamarina.com sem JSON-LD-t, sem og:image-et nem ad. */
  it("strukturált adat híján a horgony-keresés dolgozik", () => {
    const html = `
      <img src="https://x.com/white_LOGO-01.png">
      <img src="https://x.com/Coral-R-1.png">
    `;
    expect(imageFromPage(html, "Coral Raspberry")).toBe("https://x.com/Coral-R-1.png");
  });

  it("kép nélküli oldalra null (nem tippel)", () => {
    expect(imageFromPage("<p>semmi</p>", "Coral")).toBeNull();
  });
});

/**
 * MOBIL-SÚLY (2026-08-20). A Shopify-CDN `width` paraméterrel méretez;
 * a bluefinsupboards.eu JSON-LD-je `width=1920`-at ad (1656 kB).
 */
describe("displayImageUrl", () => {
  it("a Shopify-CDN szélességét a megjelenítési méretre állítja", () => {
    expect(
      displayImageUrl("https://bluefinsupboards.eu/cdn/shop/files/Rush.png?v=178&width=1920"),
    ).toBe("https://bluefinsupboards.eu/cdn/shop/files/Rush.png?v=178&width=768");
  });

  it("paraméter nélküli Shopify-képre HOZZÁADJA a szélességet", () => {
    // Élesben: a Starboard képe 165 kB → 114 kB.
    expect(displayImageUrl("https://cdn.shopify.com/s/files/1/0857/gen-r.jpg?v=17")).toBe(
      "https://cdn.shopify.com/s/files/1/0857/gen-r.jpg?v=17&width=768",
    );
  });

  it("NEM nyúl a nem-Shopify képekhez (ott a srcset dönt)", () => {
    const wp = "https://aquamarina.com/wp-content/uploads/2024/03/CASCADE-2-768x1159.png";
    expect(displayImageUrl(wp)).toBe(wp);
  });

  it("üres és értelmezhetetlen bemenetre nem törik el", () => {
    expect(displayImageUrl(null)).toBeNull();
    expect(displayImageUrl("   ")).toBeNull();
    expect(displayImageUrl("nem-url")).toBe("nem-url");
  });
});
