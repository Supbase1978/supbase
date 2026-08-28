import { describe, expect, it } from "vitest";

import {
  displayImageUrl,
  galleryCandidates,
  imageFromPage,
  MAX_GALLERY_CANDIDATES,
  rankImageSources,
  shopifyProductJsonUrl,
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

  /**
   * A `boards.image_url` ABSZOLÚT URL-t vár; az oldal `<img src>`-je viszont
   * lehet relatív vagy protokoll-relatív (élesben: Zray `//img.website.xin/…`).
   */
  it("az oldal URL-jéhez képest feloldja a relatív képhivatkozást", () => {
    const html = '<img src="//img.website.xin/images/1.jpg" alt="Coral Raspberry">';
    expect(imageFromPage(html, "Coral", "https://www.zraysports.com/productinfo/1.html")).toBe(
      "https://img.website.xin/images/1.jpg",
    );
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

/**
 * GALÉRIA-JELÖLTEK (F2.1-utó-30). A telefonos rács kétoszlopos, tehát a
 * kártya-kép kicsi — a részletet az adatlap teljes képernyős nézete adja
 * vissza, és ahhoz kell több kép. A Shopify ugyanabban a válaszban adja őket,
 * amit már letöltünk (mérve: termékenként 7–22 kép).
 */
describe("galleryCandidates", () => {
  const cover = "https://cdn.shopify.com/s/files/1/go-main.jpg?width=768";

  it("a BORÍTÓT kihagyja — az a rácsé, ne ismétlődjön a galériában", () => {
    const list = galleryCandidates(
      ["https://cdn.shopify.com/s/files/1/go-main.jpg", "https://cdn.shopify.com/s/files/1/go-deck.jpg"],
      cover,
    );
    expect(list).toEqual(["https://cdn.shopify.com/s/files/1/go-deck.jpg?width=768"]);
  });

  it("ugyanaz a KIZÁRÓ minta, mint a borító keresésénél", () => {
    const list = galleryCandidates(
      [
        "https://cdn.shopify.com/s/files/1/brand-logo.png",
        "https://cdn.shopify.com/s/files/1/construction-layers.png",
        "https://cdn.shopify.com/s/files/1/go-deck.jpg",
      ],
      null,
    );
    expect(list).toEqual(["https://cdn.shopify.com/s/files/1/go-deck.jpg?width=768"]);
  });

  it("legfeljebb 8 jelölt (a moderátor ebből válogat)", () => {
    const many = Array.from({ length: 22 }, (_, i) => `https://cdn.shopify.com/s/files/1/k${i}.jpg`);
    expect(galleryCandidates(many, null)).toHaveLength(MAX_GALLERY_CANDIDATES);
  });

  it("az ismétlődés és az üres bejegyzés kiesik", () => {
    const list = galleryCandidates(
      [
        "https://cdn.shopify.com/s/files/1/go-deck.jpg",
        "https://cdn.shopify.com/s/files/1/go-deck.jpg?width=768",
        null,
        undefined,
        "  ",
      ],
      null,
    );
    expect(list).toEqual(["https://cdn.shopify.com/s/files/1/go-deck.jpg?width=768"]);
  });

  it("kép nélküli termékre üres tömb (egy képes deszka: nincs pöttysor)", () => {
    expect(galleryCandidates([], cover)).toEqual([]);
  });
});

describe("shopifyProductJsonUrl", () => {
  it("a jelölt variáns-URL-jéből a termék saját JSON-ját adja", () => {
    expect(
      shopifyProductJsonUrl("https://star-board.com/products/igo-paddleboard?variant=123"),
    ).toBe("https://star-board.com/products/igo-paddleboard.json");
  });

  it("nem Shopify-alakú URL-re null (ott nincs mit próbálni)", () => {
    expect(shopifyProductJsonUrl("https://aquamarina.com/products/touring/coral/")).toBeNull();
    expect(shopifyProductJsonUrl("nem-url")).toBeNull();
    expect(shopifyProductJsonUrl(null)).toBeNull();
  });
});

/**
 * BÉLYEGKÉP-CSAPDA (2026-08-21, fanatic.com). A galéria-csík
 * `?width=50&height=50` képet ad — 4 kB, 50 px —, ami a katalógusban
 * használhatatlan. Ugyanaz a kép `?width=768`-cal 321 kB.
 */
describe("displayImageUrl — width-paraméteres kiszolgálók", () => {
  it("a bélyegkép-szélességet megjelenítési méretre emeli", () => {
    const url = displayImageUrl(
      "https://www.fanatic.com/system/x/original/Blitz.png?width=50&height=50&aspect_ratio=50:50",
    );
    expect(url).toContain("width=768");
    expect(url).not.toContain("height=");
    // Az `aspect_ratio` is törlődik: enélkül 768×50 jönne.
    expect(url).not.toContain("aspect_ratio");
  });

  /**
   * A VISSZATÖLTÉS a jelöltben TÁROLT URL-lel dolgozik, ami még a crawl
   * idejéből származhat — ott a `&amp;` bent maradhatott.
   */
  it("a tárolt URL-ben maradt `&amp;`-et is dekódolja", () => {
    expect(displayImageUrl("https://x.com/a.png?width=50&amp;height=50&amp;aspect_ratio=50:50")).toBe(
      "https://x.com/a.png?width=768",
    );
  });

  it("width-paraméter NÉLKÜLI, nem-Shopify URL-hez nem nyúl", () => {
    const wp = "https://aquamarina.com/wp-content/uploads/CASCADE-2-768x1159.png";
    expect(displayImageUrl(wp)).toBe(wp);
  });
});
