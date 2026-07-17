import { describe, expect, it } from "vitest";

import { getLocaleFromPath, localizePath, stripLocale } from "./url";

describe("getLocaleFromPath", () => {
  it("root path -> default locale (hu)", () => {
    expect(getLocaleFromPath("/")).toBe("hu");
  });

  it("bare locale prefix -> en", () => {
    expect(getLocaleFromPath("/en")).toBe("en");
  });

  it("hu path without prefix -> hu", () => {
    expect(getLocaleFromPath("/deszkak/x")).toBe("hu");
  });

  it("en-prefixed path -> en", () => {
    expect(getLocaleFromPath("/en/boards/x")).toBe("en");
  });

  it("unknown prefix falls back to hu", () => {
    expect(getLocaleFromPath("/de/boards/x")).toBe("hu");
  });
});

describe("stripLocale", () => {
  it("root stays root", () => {
    expect(stripLocale("/")).toBe("/");
  });

  it("bare en prefix -> root", () => {
    expect(stripLocale("/en")).toBe("/");
  });

  it("hu path is unchanged (no prefix to strip)", () => {
    expect(stripLocale("/deszkak/x")).toBe("/deszkak/x");
  });

  it("en-prefixed path loses the prefix", () => {
    expect(stripLocale("/en/boards/x")).toBe("/boards/x");
  });
});

describe("localizePath", () => {
  it("hu (default) never gets a prefix", () => {
    expect(localizePath("/deszkak/x", "hu")).toBe("/deszkak/x");
    expect(localizePath("/", "hu")).toBe("/");
  });

  it("en gets prefixed", () => {
    expect(localizePath("/deszkak/x", "en")).toBe("/en/deszkak/x");
    expect(localizePath("/", "en")).toBe("/en");
  });

  it("accepts paths without a leading slash", () => {
    expect(localizePath("deszkak/x", "en")).toBe("/en/deszkak/x");
  });

  it("round-trips with stripLocale/getLocaleFromPath", () => {
    const localized = localizePath("/boards/x", "en");
    expect(getLocaleFromPath(localized)).toBe("en");
    expect(stripLocale(localized)).toBe("/boards/x");
  });
});
