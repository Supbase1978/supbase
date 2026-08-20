import { describe, expect, it } from "vitest";

import { imageFromPage, rankImageSources, type ImageSourceCandidate } from "./images.ts";

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
