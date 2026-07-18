import { describe, expect, it } from "vitest";

import { evaluateSnapshot } from "./reading";
import type { SupIndexInput } from "./types";

const input: SupIndexInput = {
  wind_kmh: 10,
  gust_kmh: 10,
  wind_dir_deg: 0,
  water_temp_c: 20,
  storm_level: 0,
  shore_bearing_deg: null,
  water_type: "to",
};

describe("evaluateSnapshot — stale (core isStale, 30 perc)", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");

  it("10 perces snapshot → NEM stale, index kiszámolva", () => {
    const fetchedAt = new Date(now.getTime() - 10 * 60_000);
    const { result, stale } = evaluateSnapshot({ input, fetchedAt, now });
    expect(stale).toBe(false);
    expect(result.index).toBe(10);
  });

  it("29 perc → még friss", () => {
    const fetchedAt = new Date(now.getTime() - 29 * 60_000);
    expect(evaluateSnapshot({ input, fetchedAt, now }).stale).toBe(false);
  });

  it("pontosan 30 perc → elavult (a core >= küszöbe)", () => {
    const fetchedAt = new Date(now.getTime() - 30 * 60_000);
    const { result, stale } = evaluateSnapshot({ input, fetchedAt, now });
    expect(stale).toBe(true);
    // az utolsó ismert érték továbbra is rendelkezésre áll (a UI elavultként jelöli)
    expect(result.index).toBe(10);
  });

  it("31 perc → elavult", () => {
    const fetchedAt = new Date(now.getTime() - 31 * 60_000);
    expect(evaluateSnapshot({ input, fetchedAt, now }).stale).toBe(true);
  });

  it("értelmezhetetlen dátum → fail-safe elavult", () => {
    expect(evaluateSnapshot({ input, fetchedAt: "nem-datum", now }).stale).toBe(true);
  });
});
