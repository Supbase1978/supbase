import { describe, expect, it } from "vitest";

import {
  KNOWN_THRESHOLD,
  sizeConflicts,
  matchCandidate,
  planApproval,
  scorePair,
  similarity,
  trigrams,
} from "./match.ts";
import type { BoardForMatch } from "./types.ts";

const BOARDS: BoardForMatch[] = [
  { id: "b-vapor", brandName: "Aqua Marina", modelName: "Vapor", modelYear: 2024, inflatable: null },
  { id: "b-ride", brandName: "Red Paddle Co", modelName: "Ride", modelYear: 2023, inflatable: null },
  { id: "b-ray", brandName: "Fanatic", modelName: "Ray Air Touring", modelYear: null, inflatable: null },
  { id: "b-explorer", brandName: "Red Paddle Co", modelName: "Explorer", modelYear: 2024, inflatable: null },
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

/**
 * A SZERKEZET mint KIZÁRÓ jel (boteboard.com, 2026-08-29). A márka ugyanazt a
 * modellcsaládot felfújható („Rackham Aero") és kemény („Rackham Gatorshell")
 * kivitelben is árulja; a trigram-hasonlóság emiatt magas, de a kettő sosem
 * lehet ugyanaz a katalógus-sor.
 */
describe("szerkezet-ütközés", () => {
  const aero: BoardForMatch = {
    id: "b-aero",
    brandName: "BOTE",
    modelName: "Rackham Aero",
    modelYear: null,
    inflatable: true,
  };

  it("kemény jelölt NEM egyezik a felfújható testvérére", () => {
    const result = matchCandidate(
      {
        brandName: "BOTE",
        modelName: "Rackham Gatorshell",
        modelYear: null,
        specs: { inflatable: false },
      },
      [aero],
    );
    expect(result).toEqual({ kind: "new", boardId: null, confidence: 0 });
  });

  it("felfújható jelölt továbbra is egyezik", () => {
    const result = matchCandidate(
      {
        brandName: "BOTE",
        modelName: "Rackham Aero",
        modelYear: null,
        specs: { inflatable: true },
      },
      [aero],
    );
    expect(result.kind).toBe("known");
  });

  it("ISMERETLEN szerkezet nem zár ki — inkább egyezzen, mint hogy tévedjünk", () => {
    const result = matchCandidate(
      {
        brandName: "BOTE",
        modelName: "Rackham Aero",
        modelYear: null,
        specs: { inflatable: null },
      },
      [aero],
    );
    expect(result.kind).toBe("known");
  });
});

/**
 * ÚJRA-EGYEZTETÉS a tömeges jóváhagyás előtt (2026-08-20). A jelölt sora a
 * crawl pillanatában fagy meg; a bolti jelöltek java KORÁBBAN keletkezett,
 * mint a hozzájuk tartozó gyártói deszka.
 */
describe("planApproval", () => {
  const boards = [
    { id: "b1", modelName: "Atlas", modelYear: null, brandName: "Aqua Marina", inflatable: null },
    { id: "b2", modelName: "Hyper", modelYear: null, brandName: "Aqua Marina", inflatable: null },
  ];

  it("a MÁR MEGLÉVŐ deszkát nem hozza létre újra — összefésül", () => {
    // Élesben: a bolti „ATLAS" jelölt `matched_board_id` nélkül várt, mert a
    // gyártói „Atlas" deszka KÉSŐBB született meg nála.
    const plan = planApproval(
      { brandName: "Aqua Marina", modelName: "ATLAS", modelYear: null },
      boards,
    );
    expect(plan.kind).toBe("merge");
    expect(plan.kind === "merge" && plan.boardId).toBe("b1");
  });

  it("a BIZONYTALAN egyezés a moderátoré marad (nem tippelünk helyette)", () => {
    const plan = planApproval(
      { brandName: "Aqua Marina", modelName: "Atlas Pro Touring 12'6", modelYear: null },
      boards,
    );
    expect(plan.kind).toBe("moderator");
  });

  it("a tényleg ÚJ típus mehet jóváhagyásra", () => {
    const plan = planApproval(
      { brandName: "Zray", modelName: "RAPID PRO R2", modelYear: null },
      boards,
    );
    expect(plan.kind).toBe("create");
  });

  it("üres katalógusban minden jelölt új", () => {
    expect(planApproval({ brandName: "Zray", modelName: "Max Azure", modelYear: null }, []).kind).toBe(
      "create",
    );
  });
});

/**
 * ÉLESBEN MÉRT (star-board.com, 2026-09-21): a `Hyper Nut 7'4" X 30" Limited
 * Series` a `Whopper 9'0" x 33" Limited Series`-re kapott összevonási
 * javaslatot 0,57-es bizalommal. A hasonlóságot a KÖZÖS KIVITEL-utótag és az
 * azonos méret-FORMÁTUM húzta fel, nem a modellnév.
 */
describe("sizeConflicts", () => {
  it("a más méretet viselő nevek SOSEM ugyanazok", () => {
    expect(
      sizeConflicts(`Hyper Nut 7'4" X 30" Limited Series`, `Whopper 9'0" x 33" Limited Series`),
    ).toBe(true);
  });

  it("az AZONOS méret átengedi (modellév-párok összevonhatók maradnak)", () => {
    expect(
      sizeConflicts(`Whopper 10'0" X 34" ASAP`, `Whopper 10'0" x 34" ASAP`),
    ).toBe(false);
  });

  it("a gyártó KÖVETKEZETLEN írásmódja nem számít különbségnek", () => {
    // `10'0" X 34"` ⇄ `10'0” x 34` — ugyanaz a méret, más jelekkel.
    expect(sizeConflicts(`GO 10'0" X 34" Deluxe`, `GO 10'0” x 34 Deluxe`)).toBe(false);
  });

  it("méret NÉLKÜLI névnél nincs mit összevetni — nem zár ki", () => {
    // A gyártók fele nem teszi a méretet a névbe; ott a pontszám dönt.
    expect(sizeConflicts("Aqua Marina Vapor", `Whopper 9'0" x 33"`)).toBe(false);
    expect(sizeConflicts("Aqua Marina Vapor", "Aqua Marina Fusion")).toBe(false);
  });
});
