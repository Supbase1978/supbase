import { describe, expect, it } from "vitest";

import { DEFAULT_ADVISOR_CONFIG } from "./config";
import {
  allowedBoardTypes,
  effectiveWeight,
  passesHardFilter,
  purposeFitScore,
  recommendBoards,
  reviewsScore,
  scoreBoard,
  stabilityScore,
  valueScore,
} from "./select";
import type { AdvisorInputs, BoardForAdvisor } from "./types";

const CFG = DEFAULT_ADVISOR_CONFIG;

function makeBoard(overrides: Partial<BoardForAdvisor> = {}): BoardForAdvisor {
  return {
    id: "b1",
    boardType: "allround",
    volumeL: 280,
    widthCm: 81,
    maxLoadKg: 130,
    inflatable: true,
    availabilityHu: true,
    modelYear: 2024,
    priceHuf: 400000,
    reviewAvg: 4.5,
    reviewCount: 10,
    ratingValueAvg: 4,
    ...overrides,
  };
}

function makeInputs(overrides: Partial<AdvisorInputs> = {}): AdvisorInputs {
  return {
    weightKg: 80,
    passenger: "none",
    experience: "kezdo",
    use: "allround",
    water: "to",
    budgetHuf: 500000,
    storage: "any",
    ...overrides,
  };
}

describe("effectiveWeight", () => {
  it.each([
    ["none", 80],
    ["child", 95],
    ["dog", 105],
  ] as const)("passenger=%s → %d kg", (passenger, expected) => {
    expect(effectiveWeight(makeInputs({ passenger }), CFG)).toBe(expected);
  });
});

describe("passesHardFilter — 1. réteg kizárások", () => {
  // [leírás, board-override, inputs-override, várható]
  it.each<[string, Partial<BoardForAdvisor>, Partial<AdvisorInputs>, boolean]>([
    ["alap eset átmegy", {}, {}, true],
    ["alacsony max_load kizár (130×0,66=85,8 < 80? nem — 100×0,66=66<80)", { maxLoadKg: 100 }, {}, false],
    ["kis volume kizár (150 < 80×2,5=200)", { volumeL: 150 }, {}, false],
    ["hiányzó volume kizár", { volumeL: null }, {}, false],
    ["hiányzó max_load kizár", { maxLoadKg: null }, {}, false],
    ["inflatable_only + merev deszka kizár", { inflatable: false }, { storage: "inflatable_only" }, false],
    ["inflatable_only + felfújható átmegy", { inflatable: true }, { storage: "inflatable_only" }, true],
    ["budget-túllépés kizár", { priceHuf: 600000 }, { budgetHuf: 500000 }, false],
    ["hiányzó ár NEM zár ki (budget mellett sem)", { priceHuf: null }, { budgetHuf: 500000 }, true],
    ["nincs budget → nincs ár-szűrés", { priceHuf: 9000000 }, { budgetHuf: null }, true],
    ["rossz cél-típus kizár (verseny csak race)", { boardType: "allround" }, { use: "verseny" }, false],
    ["jó cél-típus átmegy (race verseny)", { boardType: "race", widthCm: 66 }, { use: "verseny" }, true],
    ["availabilityHu=false kizár", { availabilityHu: false }, {}, false],
  ])("%s", (_desc, board, inputs, expected) => {
    expect(passesHardFilter(makeBoard(board), makeInputs(inputs), CFG)).toBe(expected);
  });

  it("max_load × 0,66 ≥ effektív súly — gyerek utassal szigorúbb", () => {
    // maxLoad 130 → 85,8. none(80) átmegy, child(95) kizár, dog(105) kizár.
    const board = makeBoard();
    expect(passesHardFilter(board, makeInputs({ passenger: "none" }), CFG)).toBe(true);
    expect(passesHardFilter(board, makeInputs({ passenger: "child" }), CFG)).toBe(false);
    expect(passesHardFilter(board, makeInputs({ passenger: "dog" }), CFG)).toBe(false);
    // 160 kg terhelhetőség (×0,66=105,6) épp elbírja a gyereket (95) és kutyát (105).
    const bigger = makeBoard({ maxLoadKg: 160, volumeL: 350 });
    expect(passesHardFilter(bigger, makeInputs({ passenger: "child" }), CFG)).toBe(true);
    expect(passesHardFilter(bigger, makeInputs({ passenger: "dog" }), CFG)).toBe(true);
  });

  it("térfogat-szorzók: ugyanaz a deszka kezdőnek kizárt, versenyzőnek átmehet", () => {
    // volume 170: kezdő need 80×2,5=200 → kizár; versenyző need 80×2,0=160 → átmegy.
    const board = makeBoard({ volumeL: 170 });
    expect(passesHardFilter(board, makeInputs({ experience: "kezdo" }), CFG)).toBe(false);
    expect(passesHardFilter(board, makeInputs({ experience: "versenyzo" }), CFG)).toBe(true);
  });

  it("folyó engedi a river típust a cél-mappingen felül", () => {
    const river = makeBoard({ boardType: "river", widthCm: 86, volumeL: 260 });
    // száraz cél-mapping (allround) tavon nem engedné a river-t:
    expect(passesHardFilter(river, makeInputs({ water: "to" }), CFG)).toBe(false);
    // folyón viszont igen:
    expect(passesHardFilter(river, makeInputs({ water: "folyo" }), CFG)).toBe(true);
  });
});

describe("allowedBoardTypes", () => {
  it("folyón kiegészül river + allround típussal", () => {
    const types = allowedBoardTypes(makeInputs({ use: "verseny", water: "folyo" }));
    expect(types).toContain("race");
    expect(types).toContain("river");
    expect(types).toContain("allround");
  });
  it("tavon a nyers cél-mapping érvényes", () => {
    expect(allowedBoardTypes(makeInputs({ use: "verseny", water: "to" }))).toEqual(["race"]);
  });
});

describe("stabilityScore — 2. réteg (tapasztalat-függő)", () => {
  it("kezdő magasabb pontot ad széles, nagy-ráhagyású deszkára, mint versenyző", () => {
    const wide = makeBoard({ widthCm: 90, volumeL: 350 });
    const kezdo = stabilityScore(wide, makeInputs({ experience: "kezdo" }), CFG);
    const versenyzo = stabilityScore(wide, makeInputs({ experience: "versenyzo" }), CFG);
    expect(kezdo).toBeGreaterThan(versenyzo);
    expect(kezdo).toBeGreaterThan(0.7);
    expect(versenyzo).toBeLessThan(0.3);
  });

  it("keskeny, kis-ráhagyású deszkán fordul a reláció", () => {
    const narrow = makeBoard({ widthCm: 66, volumeL: 165 });
    const kezdo = stabilityScore(narrow, makeInputs({ experience: "kezdo" }), CFG);
    const versenyzo = stabilityScore(narrow, makeInputs({ experience: "versenyzo" }), CFG);
    expect(versenyzo).toBeGreaterThan(kezdo);
  });
});

describe("reviewsScore — Közös nevező küszöb", () => {
  it("min_count alatt semleges 0,5", () => {
    expect(reviewsScore(makeBoard({ reviewCount: 4, reviewAvg: 5 }), CFG)).toBe(0.5);
  });
  it("min_count felett avg/5", () => {
    expect(reviewsScore(makeBoard({ reviewCount: 5, reviewAvg: 4 }), CFG)).toBeCloseTo(0.8);
  });
  it("avg null → semleges 0,5 még elég értékelésnél is", () => {
    expect(reviewsScore(makeBoard({ reviewCount: 20, reviewAvg: null }), CFG)).toBe(0.5);
  });
});

describe("valueScore — ár-érték", () => {
  it("olcsóbb deszka magasabb ár-érték (azonos ratingValue)", () => {
    const cheap = valueScore(makeBoard({ priceHuf: 250000 }), makeInputs({ budgetHuf: 500000 }));
    const pricey = valueScore(makeBoard({ priceHuf: 450000 }), makeInputs({ budgetHuf: 500000 }));
    expect(cheap).toBeGreaterThan(pricey);
  });
  it("nincs budget → ratingValue/5 (vagy 0,5 ha nincs)", () => {
    expect(valueScore(makeBoard({ ratingValueAvg: 4 }), makeInputs({ budgetHuf: null }))).toBeCloseTo(0.8);
    expect(valueScore(makeBoard({ ratingValueAvg: null }), makeInputs({ budgetHuf: null }))).toBe(0.5);
  });
  it("ismert ratingValue nélkül, budget mellett 0,6 szorzó", () => {
    // pos = 1 - 250000/500000 = 0,5; ×0,6 = 0,3
    expect(valueScore(makeBoard({ priceHuf: 250000, ratingValueAvg: null }), makeInputs({ budgetHuf: 500000 }))).toBeCloseTo(0.3);
  });
});

describe("purposeFitScore", () => {
  it("elsődleges típus 1,0, másodlagos 0,7 (tavon)", () => {
    const primary = purposeFitScore(makeBoard({ boardType: "touring" }), makeInputs({ use: "tura", water: "to" }));
    const secondary = purposeFitScore(makeBoard({ boardType: "allround" }), makeInputs({ use: "tura", water: "to" }));
    expect(primary).toBeGreaterThan(secondary);
    expect(primary).toBeCloseTo(1.0);
  });
});

describe("scoreBoard — pontszám + indoklás-kulcsok", () => {
  it("0–100 közötti pontszám, egy tizedesre kerekítve", () => {
    const { score } = scoreBoard(makeBoard(), makeInputs(), CFG);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(Math.round(score * 10) / 10).toBe(score);
  });

  it("mindig tartalmaz max_load biztonsági indoklást + domináns tényezőket", () => {
    const { reasons } = scoreBoard(makeBoard(), makeInputs(), CFG);
    const keys = reasons.map((r) => r.key);
    expect(keys).toContain("reason.maxLoad");
    // domináns kettő + maxLoad = 3
    expect(reasons.length).toBe(3);
    // alap-boardon a Közös nevező (0,9×25) a legerősebb tényező
    expect(keys[0]).toBe("reason.reviews");
    // stabilitási indoklás térfogattal (volumeL ismert)
    expect(keys).toContain("reason.volume");
  });

  it("a level i18n-kulcsot adja paraméterként (nem kész szöveg)", () => {
    const { reasons } = scoreBoard(makeBoard(), makeInputs({ experience: "kezdo" }), CFG);
    const vol = reasons.find((r) => r.key === "reason.volume");
    expect(vol?.params.level).toBe("level.kezdo");
  });

  it("kevés értékelésnél a reviews-indoklás kimarad", () => {
    const { reasons } = scoreBoard(makeBoard({ reviewCount: 2 }), makeInputs(), CFG);
    expect(reasons.map((r) => r.key)).not.toContain("reason.reviews");
  });

  it("régebbi modell → reason.availability, aktuális → reason.fresh", () => {
    // Gyenge stabilitás/érték, hogy az elérhetőség domináns tényező legyen.
    const weak = {
      boardType: "touring" as const,
      volumeL: 200,
      widthCm: 60,
      ratingValueAvg: 1,
      reviewCount: 2,
      priceHuf: null,
    };
    const old = scoreBoard(makeBoard({ ...weak, modelYear: 2021 }), makeInputs({ budgetHuf: null }), CFG);
    expect(old.reasons.map((r) => r.key)).toContain("reason.availability");
    const fresh = scoreBoard(makeBoard({ ...weak, modelYear: 2024 }), makeInputs({ budgetHuf: null }), CFG);
    expect(fresh.reasons.map((r) => r.key)).toContain("reason.fresh");
  });
});

describe("recommendBoards — rangsor", () => {
  const boards: BoardForAdvisor[] = [
    makeBoard({ id: "high", reviewAvg: 5, reviewCount: 30, priceHuf: 250000 }),
    makeBoard({ id: "mid", reviewAvg: 4, reviewCount: 10, priceHuf: 400000 }),
    makeBoard({ id: "low", reviewAvg: 3, reviewCount: 8, priceHuf: 480000 }),
    makeBoard({ id: "excluded-volume", volumeL: 100 }),
    makeBoard({ id: "excluded-load", maxLoadKg: 90 }),
  ];

  it("csak a szűrésen átmentek kerülnek be, csökkenő score szerint", () => {
    const res = recommendBoards(boards, makeInputs(), CFG);
    const ids = res.map((r) => r.boardId);
    expect(ids).not.toContain("excluded-volume");
    expect(ids).not.toContain("excluded-load");
    expect(ids).toEqual(["high", "mid", "low"]);
  });

  it("limit paraméter vág", () => {
    expect(recommendBoards(boards, makeInputs(), CFG, 2)).toHaveLength(2);
  });

  it("determinisztikus tie-break azonos score-nál boardId szerint", () => {
    const tie: BoardForAdvisor[] = [
      makeBoard({ id: "zeta" }),
      makeBoard({ id: "alpha" }),
      makeBoard({ id: "mike" }),
    ];
    const res = recommendBoards(tie, makeInputs(), CFG);
    expect(res.map((r) => r.boardId)).toEqual(["alpha", "mike", "zeta"]);
    // azonos bemenet → azonos kimenet (tisztaság)
    const res2 = recommendBoards(tie, makeInputs(), CFG);
    expect(res2).toEqual(res);
  });

  it("üres jelöltlista → üres eredmény", () => {
    expect(recommendBoards([], makeInputs(), CFG)).toEqual([]);
  });
});
