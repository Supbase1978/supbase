import { describe, expect, it } from "vitest";

import { DEFAULT_OG_IMAGE_PATH, resolveOgImage } from "./og-image";

const ORIGIN = "https://supperz.netlify.app";

describe("resolveOgImage", () => {
  it("kép nélkül a márkázott alapértelmezett kártyát adja — egy oldal se maradjon kép nélkül", () => {
    expect(resolveOgImage(ORIGIN, null)).toBe(`${ORIGIN}${DEFAULT_OG_IMAGE_PATH}`);
    expect(resolveOgImage(ORIGIN, undefined)).toBe(`${ORIGIN}${DEFAULT_OG_IMAGE_PATH}`);
    expect(resolveOgImage(ORIGIN, "")).toBe(`${ORIGIN}${DEFAULT_OG_IMAGE_PATH}`);
  });

  it("relatív útvonalat ABSZOLÚTTÁ tesz — a crawlerek a relatívat nem oldják fel", () => {
    expect(resolveOgImage(ORIGIN, "/og/kep.png")).toBe(`${ORIGIN}/og/kep.png`);
    expect(resolveOgImage(ORIGIN, "og/kep.png")).toBe(`${ORIGIN}/og/kep.png`);
  });

  it("a MÁR abszolút URL-t érintetlenül hagyja (külső termékkép)", () => {
    const external = "https://cdn.pelda.hu/deszka.jpg";
    expect(resolveOgImage(ORIGIN, external)).toBe(external);
    expect(resolveOgImage(ORIGIN, "http://cdn.pelda.hu/x.png")).toBe("http://cdn.pelda.hu/x.png");
  });
});
