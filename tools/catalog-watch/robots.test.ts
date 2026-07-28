import { describe, expect, it } from "vitest";

import {
  CRAWLER_USER_AGENT,
  crawlDelayFor,
  isPathAllowed,
  parseRobotsTxt,
} from "./robots.ts";

const SHOP_ROBOTS = `
# webshop robots
User-agent: *
Disallow: /kosar
Disallow: /admin/
Allow: /admin/public
Crawl-delay: 2

User-agent: ${CRAWLER_USER_AGENT}
Disallow: /kereses
Crawl-delay: 5

Sitemap: https://bolt.hu/sitemap.xml
Sitemap: https://bolt.hu/sitemap-termek.xml
`;

describe("parseRobotsTxt", () => {
  it("csoportokra bontja a szabályokat és kigyűjti a sitemapeket", () => {
    const robots = parseRobotsTxt(SHOP_ROBOTS);
    expect(robots.groups).toHaveLength(2);
    expect(robots.sitemaps).toEqual([
      "https://bolt.hu/sitemap.xml",
      "https://bolt.hu/sitemap-termek.xml",
    ]);
  });

  it("egymást követő User-agent sorokat EGY csoportnak veszi", () => {
    const robots = parseRobotsTxt("User-agent: a\nUser-agent: b\nDisallow: /x");
    expect(robots.groups).toHaveLength(1);
    expect(robots.groups[0]?.agents).toEqual(["a", "b"]);
  });

  it("az üres Disallow nem szabály (mindent enged)", () => {
    const robots = parseRobotsTxt("User-agent: *\nDisallow:");
    expect(robots.groups[0]?.rules).toEqual([]);
    expect(isPathAllowed(robots, "/barmi")).toBe(true);
  });

  it("elhagyja a kommenteket és tolerálja a CRLF-et meg a BOM-ot", () => {
    const robots = parseRobotsTxt("\uFEFFUser-agent: *\r\nDisallow: /x # megjegyzés\r\n");
    expect(isPathAllowed(robots, "/x")).toBe(false);
  });
});

describe("isPathAllowed", () => {
  const robots = parseRobotsTxt(SHOP_ROBOTS);

  it.each([
    // A saját nevünkre szóló csoport győz a `*` felett — annak szabályai élnek.
    ["/kereses?q=sup", false, "a nekünk szóló csoport tiltja"],
    ["/kosar", true, "a `*`-csoport tiltása RÁNK nem vonatkozik"],
    ["/termek/aqua-marina-vapor", true, "termékoldal"],
  ])("%s → %s (%s)", (path, expected) => {
    expect(isPathAllowed(robots, path)).toBe(expected);
  });

  it("ismeretlen ügynöknek a `*`-csoport szól", () => {
    expect(isPathAllowed(robots, "/kosar", "MasBot")).toBe(false);
    expect(isPathAllowed(robots, "/kereses", "MasBot")).toBe(true);
  });

  it("a leghosszabb illeszkedő minta dönt (Allow felülírja a Disallow-t)", () => {
    expect(isPathAllowed(robots, "/admin/", "MasBot")).toBe(false);
    expect(isPathAllowed(robots, "/admin/public", "MasBot")).toBe(true);
  });

  it("azonos hosszú Allow és Disallow ütközésénél az Allow győz", () => {
    const tie = parseRobotsTxt("User-agent: *\nDisallow: /x\nAllow: /x");
    expect(isPathAllowed(tie, "/x")).toBe(true);
  });

  it("kezeli a `*` és `$` mintákat", () => {
    const wild = parseRobotsTxt("User-agent: *\nDisallow: /*.pdf$\nDisallow: /p/*/edit");
    expect(isPathAllowed(wild, "/doc/leiras.pdf")).toBe(false);
    expect(isPathAllowed(wild, "/doc/leiras.pdf?x=1")).toBe(true);
    expect(isPathAllowed(wild, "/p/123/edit")).toBe(false);
    expect(isPathAllowed(wild, "/p/123")).toBe(true);
  });

  it("robots.txt szabály nélkül mindent enged", () => {
    expect(isPathAllowed(parseRobotsTxt(""), "/barmi")).toBe(true);
  });
});

describe("crawlDelayFor", () => {
  it("a ránk vonatkozó csoport késleltetését adja", () => {
    const robots = parseRobotsTxt(SHOP_ROBOTS);
    expect(crawlDelayFor(robots)).toBe(5);
    expect(crawlDelayFor(robots, "MasBot")).toBe(2);
  });

  it("hiányzó Crawl-delay → null", () => {
    expect(crawlDelayFor(parseRobotsTxt("User-agent: *\nDisallow: /x"))).toBeNull();
  });
});
