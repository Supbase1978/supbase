import { describe, expect, it } from "vitest";

import {
  faqPageJsonLd,
  jsonLdScript,
  localBusinessJsonLd,
  placeJsonLd,
  productJsonLd,
} from "./jsonld";

describe("productJsonLd", () => {
  it("builds a Product with AggregateRating, Review and Offer", () => {
    const jsonLd = productJsonLd({
      name: "Vándor 11'4 Túra",
      aggregateRating: { ratingValue: 4.5, reviewCount: 12 },
      reviews: [
        {
          author: "Kata",
          reviewBody: "Nagyon stabil.",
          reviewRating: { ratingValue: 5 },
        },
      ],
      offers: { price: 259900, priceCurrency: "HUF" },
    });

    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.aggregateRating).toMatchObject({ "@type": "AggregateRating", ratingValue: 4.5 });
    expect(jsonLd.review).toEqual([
      expect.objectContaining({ "@type": "Review" }),
    ]);
    expect(jsonLd.offers).toEqual([
      expect.objectContaining({ "@type": "Offer", price: 259900, priceCurrency: "HUF" }),
    ]);
  });
});

describe("placeJsonLd", () => {
  it("builds a Place with geo coordinates", () => {
    const jsonLd = placeJsonLd({ name: "Balatonföldvár", latitude: 46.8, longitude: 17.88 });
    expect(jsonLd["@type"]).toBe("Place");
    expect(jsonLd.geo).toEqual({ "@type": "GeoCoordinates", latitude: 46.8, longitude: 17.88 });
  });
});

describe("localBusinessJsonLd", () => {
  it("builds a LocalBusiness with a PostalAddress", () => {
    const jsonLd = localBusinessJsonLd({
      name: "SUP Bérlő Kft.",
      address: { addressLocality: "Siófok", addressCountry: "HU" },
    });
    expect(jsonLd["@type"]).toBe("LocalBusiness");
    expect(jsonLd.address).toMatchObject({ "@type": "PostalAddress", addressLocality: "Siófok" });
  });
});

describe("faqPageJsonLd", () => {
  it("builds a FAQPage with Question/Answer pairs", () => {
    const jsonLd = faqPageJsonLd([{ question: "Kell-e engedély?", answer: "Nem." }]);
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "Kell-e engedély?",
        acceptedAnswer: { "@type": "Answer", text: "Nem." },
      },
    ]);
  });
});

describe("jsonLdScript", () => {
  it("serializes to JSON", () => {
    const script = jsonLdScript({ "@type": "Thing", name: "x" });
    expect(JSON.parse(script.replace(/\\u003c/g, "<"))).toEqual({ "@type": "Thing", name: "x" });
  });

  it("escapes '<' to prevent breaking out of a <script> tag (XSS)", () => {
    const script = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(script).not.toContain("</script>");
    expect(script).not.toContain("<");
    expect(script).toContain("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>");
  });
});
