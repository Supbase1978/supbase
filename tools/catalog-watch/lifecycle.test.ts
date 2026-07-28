import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNSEEN_DAYS,
  findDiscontinuedCandidates,
  nextAvailability,
  shouldRecordPrice,
  type BoardForLifecycle,
} from "./lifecycle.ts";

const NOW = new Date("2026-07-28T00:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

const BOARDS: BoardForLifecycle[] = [
  {
    id: "friss",
    modelName: "Vapor",
    status: "active",
    last_seen_at: daysAgo(3),
    availability_hu: true,
  },
  {
    id: "regota-nem-latott",
    modelName: "Ride",
    status: "active",
    last_seen_at: daysAgo(40),
    availability_hu: true,
  },
  {
    id: "sosem-latott",
    modelName: "Kézi felvitel",
    status: "active",
    last_seen_at: null,
    availability_hu: false,
  },
  {
    id: "mar-kifutott",
    modelName: "Régi",
    status: "discontinued",
    last_seen_at: daysAgo(200),
    availability_hu: false,
  },
];

describe("findDiscontinuedCandidates", () => {
  it("csak a küszöbnél régebben nem látott AKTÍV deszkát jelöli", () => {
    const found = findDiscontinuedCandidates(BOARDS, { now: NOW });
    expect(found.map((c) => c.boardId)).toEqual(["regota-nem-latott"]);
    expect(found[0]?.daysUnseen).toBe(40);
  });

  it("amit a figyelő SOHA nem látott, azt nem bántja (kézi/seed sorok)", () => {
    const found = findDiscontinuedCandidates(BOARDS, { now: NOW, unseenDays: 1 });
    expect(found.map((c) => c.boardId)).not.toContain("sosem-latott");
  });

  it("a már kifutott sort nem jelöli újra", () => {
    const found = findDiscontinuedCandidates(BOARDS, { now: NOW, unseenDays: 1 });
    expect(found.map((c) => c.boardId)).not.toContain("mar-kifutott");
  });

  it("a küszöb pontosan a határon is jelöl (>=)", () => {
    const onEdge: BoardForLifecycle[] = [
      {
        id: "hatar",
        modelName: "H",
        status: "active",
        last_seen_at: daysAgo(DEFAULT_UNSEEN_DAYS),
        availability_hu: true,
      },
    ];
    expect(findDiscontinuedCandidates(onEdge, { now: NOW })).toHaveLength(1);
  });

  it("a legrégebben nem látott van elöl", () => {
    const found = findDiscontinuedCandidates(
      [
        { ...(BOARDS[1] as BoardForLifecycle), id: "a", last_seen_at: daysAgo(30) },
        { ...(BOARDS[1] as BoardForLifecycle), id: "b", last_seen_at: daysAgo(90) },
      ],
      { now: NOW },
    );
    expect(found.map((c) => c.boardId)).toEqual(["b", "a"]);
  });

  it("értelmezhetetlen dátumot kihagy, nem dob", () => {
    const broken: BoardForLifecycle[] = [
      {
        id: "rossz",
        modelName: "R",
        status: "active",
        last_seen_at: "nem-datum",
        availability_hu: true,
      },
    ];
    expect(findDiscontinuedCandidates(broken, { now: NOW })).toEqual([]);
  });
});

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
