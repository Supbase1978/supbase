import { describe, expect, it } from "vitest";

import { isStale, minutesSince, STALE_THRESHOLD_MINUTES } from "./data-age";

describe("data-age", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");

  it("STALE_THRESHOLD_MINUTES 30", () => {
    expect(STALE_THRESHOLD_MINUTES).toBe(30);
  });

  it("29 perc — még friss", () => {
    const updatedAt = new Date(now.getTime() - 29 * 60_000);
    expect(minutesSince(updatedAt, now)).toBeCloseTo(29);
    expect(isStale(updatedAt, now)).toBe(false);
  });

  it("30 perc — pontosan a küszöbön már elavult", () => {
    const updatedAt = new Date(now.getTime() - 30 * 60_000);
    expect(minutesSince(updatedAt, now)).toBeCloseTo(30);
    expect(isStale(updatedAt, now)).toBe(true);
  });

  it("31 perc — elavult", () => {
    const updatedAt = new Date(now.getTime() - 31 * 60_000);
    expect(isStale(updatedAt, now)).toBe(true);
  });

  it("string ISO dátumot is elfogad", () => {
    const iso = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(minutesSince(iso, now)).toBeCloseTo(5);
    expect(isStale(iso, now)).toBe(false);
  });

  it("érvénytelen dátum — biztonsági okból elavultnak számít", () => {
    expect(isStale("nem-egy-dátum", now)).toBe(true);
    expect(Number.isNaN(minutesSince("nem-egy-dátum", now))).toBe(true);
  });

  it("jövőbeli időbélyeg (negatív eltelt idő) nem elavult", () => {
    const updatedAt = new Date(now.getTime() + 5 * 60_000);
    expect(isStale(updatedAt, now)).toBe(false);
  });
});
