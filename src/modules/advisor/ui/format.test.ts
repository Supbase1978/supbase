import { describe, expect, it } from "vitest";

import { cmToFeetInches } from "./format";

describe("cmToFeetInches", () => {
  it.each([
    [335, "11'0\""], // a katalógus X100 11'0"
    [381, "12'6\""], // Ray Air 12'6"
    [366, "12'0\""],
    [320, "10'6\""],
    [290, "9'6\""],
  ])("%i cm → %s (a piaci láb-jelölés)", (cm, expected) => {
    expect(cmToFeetInches(cm)).toBe(expected);
  });

  it("a 12 hüvelykes túlcsordulást átviszi lábra (11'12\" helyett 12'0\")", () => {
    // 365,7 cm ≈ 144 hüvelyk = pontosan 12 láb.
    expect(cmToFeetInches(365.7)).toBe("12'0\"");
  });
});
