import { describe, expect, it } from "vitest";

import { normalizedUrl } from "./request-url";

const req = (url: string) => new Request(url);

describe("normalizedUrl", () => {
  it("dokumentum-kérést érintetlenül hagy", () => {
    const url = normalizedUrl(req("https://suptime.app/en/deszkak?suly=85"));
    expect(url.pathname).toBe("/en/deszkak");
    expect(url.search).toBe("?suly=85");
  });

  it("levágja a .data utótagot", () => {
    expect(normalizedUrl(req("https://suptime.app/deszkak.data")).pathname).toBe("/deszkak");
  });

  it("a záró perjeles data-kérésből záró perjeles útvonalat csinál", () => {
    expect(normalizedUrl(req("https://suptime.app/a/b/c/_.data")).pathname).toBe("/a/b/c/");
  });

  it("a gyökér data-kérés a / útvonal", () => {
    expect(normalizedUrl(req("https://suptime.app/_.data")).pathname).toBe("/");
  });

  it("kiveszi a belső _routes és index paramétereket, a többit megtartja", () => {
    const url = normalizedUrl(req("https://suptime.app/deszkak.data?_routes=a%2Cb&index&suly=85"));
    expect(url.pathname).toBe("/deszkak");
    expect(url.search).toBe("?suly=85");
  });
});
