import { describe, expect, it } from "vitest";

import { buildDirectionsUrl } from "./directions";

describe("buildDirectionsUrl", () => {
  it("apple platformon az Apple Maps daddr-linkjét adja", () => {
    expect(buildDirectionsUrl(46.9, 17.9, "apple")).toBe(
      "https://maps.apple.com/?daddr=46.9,17.9",
    );
  });

  it("other platformon a Google Maps útvonaltervező linkjét adja", () => {
    expect(buildDirectionsUrl(46.9, 17.9, "other")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=46.9,17.9",
    );
  });

  it("negatív koordinátákkal is helyes URL-t ad", () => {
    expect(buildDirectionsUrl(-33.86, 151.2, "other")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-33.86,151.2",
    );
  });
});
