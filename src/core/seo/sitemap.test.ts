import { describe, expect, it } from "vitest";

import { buildSitemapXml, STATIC_SITEMAP_PATHS } from "./sitemap";

describe("buildSitemapXml", () => {
  const xml = buildSitemapXml("https://sup.hu", ["/deszkak", "/deszkak/x100"]);

  it("érvényes urlset-fejléc xhtml-névtérrel", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it("csak élő locale (hu) <url>-jei — nincs 404-es /en bejegyzés", () => {
    expect(xml).toContain("<loc>https://sup.hu/deszkak</loc>");
    expect(xml).toContain("<loc>https://sup.hu/deszkak/x100</loc>");
    expect(xml).not.toContain("/en/deszkak");
  });

  it("hreflang alternate + x-default minden url-nél (aktív locale)", () => {
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="hu" href="https://sup.hu/deszkak"/>',
    );
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://sup.hu/deszkak"/>',
    );
  });

  it("üres path-lista is érvényes (üres urlset)", () => {
    expect(buildSitemapXml("https://sup.hu", [])).toContain("<urlset");
  });

  it("a statikus path-lista tartalmazza a jogi oldalakat is", () => {
    expect(STATIC_SITEMAP_PATHS).toContain("/aszf");
    expect(STATIC_SITEMAP_PATHS).toContain("/adatvedelem");
  });
});
