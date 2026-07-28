import { describe, expect, it } from "vitest";

import { KNOWN_THRESHOLD, matchCandidate, scorePair, similarity, trigrams } from "./match.ts";
import type { BoardForMatch } from "./types.ts";

const BOARDS: BoardForMatch[] = [
  { id: "b-vapor", brandName: "Aqua Marina", modelName: "Vapor", modelYear: 2024 },
  { id: "b-ride", brandName: "Red Paddle Co", modelName: "Ride", modelYear: 2023 },
  { id: "b-ray", brandName: "Fanatic", modelName: "Ray Air Touring", modelYear: null },
  { id: "b-explorer", brandName: "Red Paddle Co", modelName: "Explorer", modelYear: 2024 },
];

describe("trigrams", () => {
  it("a pg_trgm párnázását követi (két szóköz elöl, egy hátul)", () => {
    expect([...trigrams("ab")]).toEqual(["  a", " ab", "ab "]);
  });

  it("ékezetet hajt és szavakra bont", () => {
    expect(trigrams("Túra")).toEqual(trigrams("tura"));
    expect(trigrams("Ray Air").size).toBeGreaterThan(trigrams("Ray").size);
  });
});

describe("similarity", () => {
  it("azonos szöveg → 1", () => {
    expect(similarity("Vapor", "vapor")).toBe(1);
  });

  it("teljesen eltérő szöveg → alacsony", () => {
    expect(similarity("Vapor", "Explorer")).toBeLessThan(0.2);
  });

  it("üres bemenet → 0", () => {
    expect(similarity("", "Vapor")).toBe(0);
  });

  it("elgépelés csak enyhén ront", () => {
    expect(similarity("Ray Air Touring", "Ray Air Turing")).toBeGreaterThan(0.6);
  });
});

describe("scorePair", () => {
  it("az eltérő évjárat ront, de nem zár ki", () => {
    const same = scorePair(
      { brandName: "Aqua Marina", modelName: "Vapor", modelYear: 2024 },
      BOARDS[0] as BoardForMatch,
    );
    const other = scorePair(
      { brandName: "Aqua Marina", modelName: "Vapor", modelYear: 2022 },
      BOARDS[0] as BoardForMatch,
    );
    expect(other.score).toBeLessThan(same.score);
    expect(other.score).toBeGreaterThan(0.7);
  });
});

describe("matchCandidate", () => {
  it("pontos márka+modell → ismert deszka", () => {
    const result = matchCandidate(
      { brandName: "Aqua Marina", modelName: "Vapor", modelYear: 2024 },
      BOARDS,
    );
    expect(result).toMatchObject({ kind: "known", boardId: "b-vapor" });
    expect(result.confidence).toBeGreaterThanOrEqual(KNOWN_THRESHOLD);
  });

  it("ismeretlen modell → új jelölt", () => {
    const result = matchCandidate(
      { brandName: "Gladiator", modelName: "Origin Pro", modelYear: 2026 },
      BOARDS,
    );
    expect(result).toMatchObject({ kind: "new", boardId: null });
  });

  it("hasonló, de nem azonos név → bizonytalan (moderációs sorba kerül)", () => {
    const result = matchCandidate(
      { brandName: "Fanatic", modelName: "Ray Air Premium", modelYear: 2026 },
      BOARDS,
    );
    expect(result.kind).toBe("uncertain");
    expect(result.boardId).toBe("b-ray");
  });

  it("AZONOS modellnév MÁS márkától nem olvad össze (rossz árat írna)", () => {
    const result = matchCandidate(
      { brandName: "Jobe", modelName: "Explorer", modelYear: 2026 },
      BOARDS,
    );
    expect(result.kind).not.toBe("known");
  });

  it("márka nélküli jelölt sosem lesz automatikusan ismert", () => {
    const result = matchCandidate({ brandName: null, modelName: "Vapor", modelYear: null }, BOARDS);
    expect(result.kind).not.toBe("known");
  });

  it("üres katalógus → minden új", () => {
    expect(matchCandidate({ brandName: "X", modelName: "Y", modelYear: null }, [])).toEqual({
      kind: "new",
      boardId: null,
      confidence: 0,
    });
  });
});
