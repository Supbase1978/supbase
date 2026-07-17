import { describe, expect, it } from "vitest";

import { buildHreflangLinks, buildMeta } from "./meta";

describe("buildMeta", () => {
  it("includes title, description and OG tags", () => {
    const meta = buildMeta({ title: "Vándor 11'4 Túra", description: "Allround túradeszka." });
    expect(meta).toContainEqual({ title: "Vándor 11'4 Túra" });
    expect(meta).toContainEqual({ name: "description", content: "Allround túradeszka." });
    expect(meta).toContainEqual({ property: "og:title", content: "Vándor 11'4 Túra" });
  });

  it("adds a canonical link when canonicalUrl is given", () => {
    const meta = buildMeta({
      title: "t",
      description: "d",
      canonicalUrl: "https://example.com/deszkak/vandor",
    });
    expect(meta).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://example.com/deszkak/vandor",
    });
  });

  it("omits the canonical link when canonicalUrl is not given", () => {
    const meta = buildMeta({ title: "t", description: "d" });
    expect(meta.some((entry) => "tagName" in entry && entry.tagName === "link")).toBe(false);
  });
});

describe("buildHreflangLinks", () => {
  it("emits one alternate link per locale plus x-default pointing at hu", () => {
    const links = buildHreflangLinks((locale) => `https://example.com/${locale}/deszkak/vandor`);

    expect(links).toContainEqual({
      rel: "alternate",
      hrefLang: "hu",
      href: "https://example.com/hu/deszkak/vandor",
    });
    expect(links).toContainEqual({
      rel: "alternate",
      hrefLang: "en",
      href: "https://example.com/en/deszkak/vandor",
    });

    const xDefault = links.find((link) => "hrefLang" in link && link.hrefLang === "x-default");
    expect(xDefault).toEqual({
      rel: "alternate",
      hrefLang: "x-default",
      href: "https://example.com/hu/deszkak/vandor",
    });
  });
});
