import { describe, expect, it } from "vitest";

import { describeAge, isStale, minutesSince, STALE_THRESHOLD_MINUTES } from "./data-age";

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

describe("describeAge", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");

  function minutesAgo(minutes: number): Date {
    return new Date(now.getTime() - minutes * 60_000);
  }

  it("38 perc — perc egység", () => {
    expect(describeAge(minutesAgo(38), now)).toEqual({ unit: "minute", count: 38 });
  });

  it("59 perc — még perc egység", () => {
    expect(describeAge(minutesAgo(59), now)).toEqual({ unit: "minute", count: 59 });
  });

  it("59.6 perc — a kerekítés nem billenti át 60 percre, óra egységre vált", () => {
    expect(describeAge(minutesAgo(59.6), now)).toEqual({ unit: "hour", count: 1 });
  });

  it("60 perc — óra egység, 1", () => {
    expect(describeAge(minutesAgo(60), now)).toEqual({ unit: "hour", count: 1 });
  });

  it("180 perc (3 óra) — óra egység, 3", () => {
    expect(describeAge(minutesAgo(180), now)).toEqual({ unit: "hour", count: 3 });
  });

  it("23.6 óra — a kerekítés nem billenti át 24 órára, nap egységre vált", () => {
    expect(describeAge(minutesAgo(23.6 * 60), now)).toEqual({ unit: "day", count: 1 });
  });

  it("24 óra — nap egység, 1", () => {
    expect(describeAge(minutesAgo(24 * 60), now)).toEqual({ unit: "day", count: 1 });
  });

  it("2 nap — nap egység, 2", () => {
    expect(describeAge(minutesAgo(2 * 24 * 60), now)).toEqual({ unit: "day", count: 2 });
  });

  it("érvénytelen dátum — biztonsági okból 0 perces korral tér vissza", () => {
    expect(describeAge("nem-egy-dátum", now)).toEqual({ unit: "minute", count: 0 });
  });

  it("jövőbeli időbélyeg — 0 perces korral tér vissza", () => {
    expect(describeAge(minutesAgo(-5), now)).toEqual({ unit: "minute", count: 0 });
  });
});
