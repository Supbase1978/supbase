import { describe, expect, it } from "vitest";

import { absoluteUrl, buildPageSeo, siteOrigin } from "./page-seo";

function req(url: string): Request {
  return new Request(url);
}

describe("siteOrigin", () => {
  it("env nélkül a kérés origin-jára esik vissza", () => {
    expect(siteOrigin(req("http://localhost:5173/deszkak"))).toBe("http://localhost:5173");
  });
});

describe("absoluteUrl", () => {
  it("hu (alap) prefix nélkül, en prefixelve", () => {
    const request = req("https://sup.hu/deszkak");
    expect(absoluteUrl(request, "/deszkak", "hu")).toBe("https://sup.hu/deszkak");
    expect(absoluteUrl(request, "/deszkak", "en")).toBe("https://sup.hu/en/deszkak");
  });
});

describe("buildPageSeo", () => {
  const request = req("https://sup.hu/deszkak");
  const descriptors = buildPageSeo({
    request,
    locale: "hu",
    path: "/deszkak",
    title: "Deszkák",
    description: "SUP-deszkák",
  });

  it("tartalmazza a title-t, description-t és az OG-t", () => {
    expect(descriptors).toContainEqual({ title: "Deszkák" });
    expect(descriptors).toContainEqual({ name: "description", content: "SUP-deszkák" });
    expect(descriptors).toContainEqual({ property: "og:title", content: "Deszkák" });
  });

  it("canonical az aktuális locale-ra mutat", () => {
    expect(descriptors).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://sup.hu/deszkak",
    });
  });

  it("hreflang CSAK élő locale-hoz (hu) + x-default — nincs 404-es /en", () => {
    expect(descriptors).toContainEqual({
      tagName: "link",
      rel: "alternate",
      hrefLang: "hu",
      href: "https://sup.hu/deszkak",
    });
    expect(descriptors).toContainEqual({
      tagName: "link",
      rel: "alternate",
      hrefLang: "x-default",
      href: "https://sup.hu/deszkak",
    });
    // en NINCS hirdetve (activeLocales = ["hu"]).
    expect(descriptors).not.toContainEqual(
      expect.objectContaining({ hrefLang: "en" }),
    );
  });
});
