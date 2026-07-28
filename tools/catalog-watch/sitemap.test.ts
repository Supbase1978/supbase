import { describe, expect, it } from "vitest";

import { parseSitemap, selectProductUrls } from "./sitemap.ts";

const URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://bolt.hu/termek/aqua-marina-vapor</loc><lastmod>2026-07-01</lastmod></url>
  <url><loc>https://bolt.hu/termek/red-paddle-ride-10-6?szin=kek&amp;m=1</loc></url>
  <url><loc>https://bolt.hu/blog/sup-kezdoknek</loc></url>
</urlset>`;

const INDEX = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://bolt.hu/sitemap-termek-1.xml</loc></sitemap>
  <sitemap><loc>https://bolt.hu/sitemap-blog.xml</loc></sitemap>
</sitemapindex>`;

describe("parseSitemap", () => {
  it("urlset-et ismer fel és feloldja az XML-entitásokat", () => {
    const parsed = parseSitemap(URLSET);
    expect(parsed.kind).toBe("urlset");
    expect(parsed.locs).toHaveLength(3);
    expect(parsed.locs[1]).toBe("https://bolt.hu/termek/red-paddle-ride-10-6?szin=kek&m=1");
  });

  it("sitemapindexet ismer fel", () => {
    const parsed = parseSitemap(INDEX);
    expect(parsed.kind).toBe("index");
    expect(parsed.locs).toHaveLength(2);
  });

  it("kezeli a CDATA-t és a névtér-prefixes tageket", () => {
    const parsed = parseSitemap(
      "<urlset><url><loc><![CDATA[https://bolt.hu/a]]></loc></url></urlset>",
    );
    expect(parsed.locs).toEqual(["https://bolt.hu/a"]);
  });

  it("értelmezhetetlen bemenetnél üres listát ad, nem dob", () => {
    expect(parseSitemap("").locs).toEqual([]);
    expect(parseSitemap("<html>hopp</html>").locs).toEqual([]);
  });
});

describe("selectProductUrls", () => {
  const locs = parseSitemap(URLSET).locs;

  it("minta nélkül minden URL termék-jelölt", () => {
    expect(selectProductUrls(locs)).toHaveLength(3);
  });

  it("a befoglaló minta szűr", () => {
    expect(selectProductUrls(locs, { productUrlPatterns: ["/termek/"] })).toHaveLength(2);
  });

  it("a kizáró minta erősebb a befoglalónál", () => {
    const selected = selectProductUrls(locs, {
      productUrlPatterns: ["/termek/"],
      excludeUrlPatterns: ["?szin="],
    });
    expect(selected).toEqual(["https://bolt.hu/termek/aqua-marina-vapor"]);
  });

  it("duplikátumot kiszűr és tiszteli a maxProducts korlátot", () => {
    const selected = selectProductUrls([...locs, ...locs], { maxProducts: 2 });
    expect(selected).toEqual([locs[0], locs[1]]);
  });
});
