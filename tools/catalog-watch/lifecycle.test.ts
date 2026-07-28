import { describe, expect, it } from "vitest";

import { nextAvailability, shouldRecordPrice } from "./lifecycle.ts";

describe("nextAvailability", () => {
  it.each([
    [true, true, null], // nincs változás → nem írunk
    [true, false, false],
    [false, true, true],
  ])("availability_hu=%s, látott=%s → %s", (current, seen, expected) => {
    expect(nextAvailability({ availability_hu: current }, seen)).toBe(expected);
  });

  it("a mostani futásban nem érintett deszkát nem nyúlja meg", () => {
    expect(nextAvailability({ availability_hu: true }, undefined)).toBeNull();
  });
});

describe("shouldRecordPrice", () => {
  it.each([
    [null, 189000, true], // ettől a bolttól még nincs ár
    [undefined, 189000, true],
    [189000, 189000, false], // változatlan ár → nem hízlaljuk a táblát
    [199000, 189000, true], // árváltozás → új sor az ártörténetbe
  ])("előző=%s, mostani=%s → %s", (previous, next, expected) => {
    expect(shouldRecordPrice(previous, next)).toBe(expected);
  });
});
