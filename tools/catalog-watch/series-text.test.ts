import { describe, expect, it } from "vitest";

import { seriesTextFromPayload, seriesTextUrlFor } from "./series-text.ts";

describe("seriesTextFromPayload", () => {
  it("a Shopify kollekció-JSON `description` mezőjét adja, szöveggé oldva", () => {
    // rocoutdoors.com — EZ az a mondat, ami miatt a mechanizmus született: a
    // teherbírás a termékoldalon SEHOL nem áll, csak itt.
    const payload = JSON.stringify({
      collection: {
        handle: "explorer-series",
        description:
          "<div class=\"rte\"><p>The Explorer series boards are 10’ tall, 32 inches wide with a weight capacity of 350 pounds.</p></div>",
      },
    });
    expect(seriesTextFromPayload(payload)).toContain("weight capacity of 350 pounds");
    expect(seriesTextFromPayload(payload)).not.toContain("<p>");
  });

  it("a termék-JSON `body_html`-jét is elfogadja", () => {
    const payload = JSON.stringify({ product: { body_html: "<p>10' tall</p>" } });
    expect(seriesTextFromPayload(payload)).toBe("10' tall");
  });

  it("HTML-választ a szokásos szöveggé alakítással visz", () => {
    expect(seriesTextFromPayload("<html><body><p>350 pounds</p></body></html>")).toContain(
      "350 pounds",
    );
  });

  it("ROMLOTT vagy ismeretlen JSON-ra ÜRESET ad, nem hibát", () => {
    // Egy elérhetetlen vagy megváltozott sorozat-leírás nem viheti el a
    // termék kinyerését: a hívó ilyenkor a termékoldalról dolgozik tovább.
    expect(seriesTextFromPayload("{ ez nem json")).toBe("");
    expect(seriesTextFromPayload(JSON.stringify({ egyeb: 1 }))).toBe("");
    expect(seriesTextFromPayload(JSON.stringify({ collection: { description: "" } }))).toBe("");
  });
});

describe("seriesTextUrlFor", () => {
  const map = {
    "/products/explorer": "https://example.com/collections/explorer-series.json",
    "/products/10-scout-": "https://example.com/collections/scout-series.json",
  };

  it("URL-részletre illeszt", () => {
    expect(seriesTextUrlFor("https://example.com/products/10-scout-aqua-1", map)).toBe(
      "https://example.com/collections/scout-series.json",
    );
  });

  it("A LEGHOSSZABB illeszkedő kulcs nyer", () => {
    // Az objektum bejárási sorrendje nem lehet a döntés alapja: ha egy
    // szűkebb kulcs is illeszkedik, az a specifikusabb sorozat.
    const nested = {
      "/products/explorer": "https://example.com/collections/explorer-series.json",
      "/products/explorer-pro": "https://example.com/collections/explorer-pro.json",
    };
    expect(seriesTextUrlFor("https://example.com/products/explorer-pro", nested)).toBe(
      "https://example.com/collections/explorer-pro.json",
    );
  });

  it("nincs találat → null (a termék a saját oldaláról jön)", () => {
    expect(seriesTextUrlFor("https://example.com/products/backpack", map)).toBeNull();
    expect(seriesTextUrlFor("https://example.com/products/explorer", {})).toBeNull();
  });
});
