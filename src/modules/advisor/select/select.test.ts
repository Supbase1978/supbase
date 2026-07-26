import { describe, expect, it } from "vitest";

import { DEFAULT_ADVISOR_CONFIG } from "./config";
import {
  allowedBoardTypes,
  effectiveWeight,
  passesHardFilter,
  purposeFitScore,
  recommendBoards,
  explainNoMatch,
  idealLengthCm,
  lengthFitScore,
  reviewsScore,
  scoreBoard,
  targetVolumeL,
  targetWidthCm,
  thicknessFitScore,
  volumeFitScore,
  widthFitScore,
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
    lengthCm: 320,
    thicknessCm: 14,
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
    heightCm: 175,
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

describe("stabilityScore — sáv-alapú illeszkedés, nem monoton", () => {
  it("a cél-térfogaton és cél-szélességen áll a maximum", () => {
    const inputs = makeInputs({ weightKg: 85, experience: "kezdo" });
    // Pontosan a célon (kerekítés nélkül) — a kerekítés önmagában is ronthat.
    const perfect = makeBoard({
      volumeL: targetVolumeL(inputs, CFG),
      widthCm: targetWidthCm(inputs, CFG),
      thicknessCm: CFG.thicknessFit.targetCm,
    });
    expect(stabilityScore(perfect, inputs, CFG)).toBeCloseTo(1, 5);
  });

  it("a TÚL NAGY térfogat is ront (ez a lényegi váltás a régi logikához képest)", () => {
    const inputs = makeInputs({ weightKg: 85, experience: "kezdo" });
    const target = targetVolumeL(inputs, CFG);
    const onTarget = volumeFitScore(makeBoard({ volumeL: Math.round(target) }), inputs, CFG);
    const oversized = volumeFitScore(
      makeBoard({ volumeL: Math.round(target) + 60 }),
      inputs,
      CFG,
    );
    expect(oversized).toBeLessThan(onTarget);
  });

  it("a TÚL SZÉLES deszka is ront (32\" az optimum, nem a legszélesebb)", () => {
    const inputs = makeInputs({ weightKg: 85, experience: "kezdo" });
    const onTarget = widthFitScore(makeBoard({ widthCm: 83 }), inputs, CFG);
    const tooWide = widthFitScore(makeBoard({ widthCm: 90 }), inputs, CFG);
    const tooNarrow = widthFitScore(makeBoard({ widthCm: 70 }), inputs, CFG);
    expect(onTarget).toBeGreaterThan(tooWide);
    expect(onTarget).toBeGreaterThan(tooNarrow);
  });

  it("nehezebb evezősnek nagyobb térfogat és szélesebb deszka a cél", () => {
    const light = makeInputs({ weightKg: 65 });
    const heavy = makeInputs({ weightKg: 100 });
    expect(targetVolumeL(heavy, CFG)).toBeGreaterThan(targetVolumeL(light, CFG));
    expect(targetWidthCm(heavy, CFG)).toBeGreaterThan(targetWidthCm(light, CFG));
  });

  it("versenyzőnek kevesebb liter és keskenyebb deszka a cél, mint kezdőnek", () => {
    const beginner = makeInputs({ weightKg: 85, experience: "kezdo" });
    const racer = makeInputs({ weightKg: 85, experience: "versenyzo" });
    expect(targetVolumeL(racer, CFG)).toBeLessThan(targetVolumeL(beginner, CFG));
    expect(targetWidthCm(racer, CFG)).toBeLessThan(targetWidthCm(beginner, CFG));
  });

  it("a kezdő cél-méretek a szakirodalmi sávban vannak (65/85/100 kg)", () => {
    // Forrás: Kezdők_tanácsok/sup-kezdo.md méret-táblája + supzone/supshop.
    const cases = [
      { weightKg: 65, volume: [270, 310], width: [79, 83] },
      { weightKg: 85, volume: [300, 345], width: [81, 86] },
      { weightKg: 100, volume: [335, 385], width: [83, 88] },
    ] as const;
    for (const c of cases) {
      const inputs = makeInputs({ weightKg: c.weightKg, experience: "kezdo" });
      const v = targetVolumeL(inputs, CFG);
      const w = targetWidthCm(inputs, CFG);
      expect(v, `${c.weightKg} kg térfogat`).toBeGreaterThanOrEqual(c.volume[0]);
      expect(v, `${c.weightKg} kg térfogat`).toBeLessThanOrEqual(c.volume[1]);
      expect(w, `${c.weightKg} kg szélesség`).toBeGreaterThanOrEqual(c.width[0]);
      expect(w, `${c.weightKg} kg szélesség`).toBeLessThanOrEqual(c.width[1]);
    }
  });

  it("a vastagság a 12–15 cm-es sávban a legjobb, a 20 cm-es ront", () => {
    expect(thicknessFitScore(makeBoard({ thicknessCm: 14 }), CFG)).toBe(1);
    expect(thicknessFitScore(makeBoard({ thicknessCm: 20 }), CFG)).toBeLessThan(
      thicknessFitScore(makeBoard({ thicknessCm: 15 }), CFG),
    );
  });

  it("hiányzó méret-adat semleges 0,5 (nem büntet)", () => {
    const inputs = makeInputs();
    expect(volumeFitScore(makeBoard({ volumeL: null }), inputs, CFG)).toBe(0.5);
    expect(widthFitScore(makeBoard({ widthCm: null }), inputs, CFG)).toBe(0.5);
    expect(thicknessFitScore(makeBoard({ thicknessCm: null }), CFG)).toBe(0.5);
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
    // A hossz szándékosan null: így a hossz-illeszkedés semleges (0,5) ÉS nem
    // ad indoklást, tehát nem veszi el az elérhetőség helyét a top-2-ből.
    const weak = {
      boardType: "touring" as const,
      volumeL: 200,
      widthCm: 60,
      lengthCm: null,
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

describe("idealLengthCm / lengthFitScore — súly-bázis + magasság-korrekció", () => {
  it("a referencia-súlynál és -magasságnál a referencia-hosszt adja", () => {
    expect(idealLengthCm(makeInputs({ weightKg: 65, heightCm: 175 }), CFG)).toBe(320);
  });

  it("NEHEZEBB evezősnek hosszabb deszka az ideális (ez volt a hiányzó szempont)", () => {
    const light = idealLengthCm(makeInputs({ weightKg: 65, heightCm: 175 }), CFG);
    const heavy = idealLengthCm(makeInputs({ weightKg: 100, heightCm: 175 }), CFG);
    expect(heavy).toBeGreaterThan(light);
  });

  it("magasabb evezősnek is hosszabb, de a súly a fő hajtóerő", () => {
    const short = idealLengthCm(makeInputs({ weightKg: 85, heightCm: 165 }), CFG);
    const tall = idealLengthCm(makeInputs({ weightKg: 85, heightCm: 195 }), CFG);
    expect(tall).toBeGreaterThan(short);
    // 30 cm magasság-különbség kevesebbet mozdít, mint 35 kg súly-különbség.
    const heavier = idealLengthCm(makeInputs({ weightKg: 120, heightCm: 165 }), CFG);
    expect(heavier - short).toBeGreaterThan(tall - short);
  });

  it("egy NEHÉZ, ALACSONY evezős sem kap túl rövid deszkát (a régi hiba)", () => {
    // Korábban csak a magasság számított: 100 kg / 170 cm → 314 cm.
    const ideal = idealLengthCm(makeInputs({ weightKg: 100, heightCm: 170 }), CFG);
    expect(ideal).toBeGreaterThanOrEqual(335); // az útmutató 11–12' sávja
  });

  it("magasság nélkül is számol (csak a súly-bázisból)", () => {
    const withoutHeight = idealLengthCm(makeInputs({ weightKg: 85, heightCm: null }), CFG);
    expect(withoutHeight).toBeGreaterThan(0);
    expect(withoutHeight).toBe(idealLengthCm(makeInputs({ weightKg: 85, heightCm: 175 }), CFG));
  });

  it("a min/max közé vág (nem ad abszurd ajánlást)", () => {
    expect(idealLengthCm(makeInputs({ weightKg: 30, heightCm: 120 }), CFG)).toBe(
      CFG.lengthFit.minLengthCm,
    );
    expect(idealLengthCm(makeInputs({ weightKg: 200, heightCm: 220 }), CFG)).toBe(
      CFG.lengthFit.maxLengthCm,
    );
  });

  it("pontos illeszkedésnél 1, a toleranciahatáron 0", () => {
    const inputs = makeInputs({ weightKg: 65, heightCm: 175 });
    expect(lengthFitScore(makeBoard({ lengthCm: 320 }), inputs, CFG)).toBe(1);
    expect(
      lengthFitScore(makeBoard({ lengthCm: 320 + CFG.lengthFit.toleranceCm }), inputs, CFG),
    ).toBe(0);
  });

  it("a hossz SOHA nem zár ki — a kemény szűrés csak biztonsági (5.2)", () => {
    const board = makeBoard({ lengthCm: 500 });
    expect(passesHardFilter(board, makeInputs({ heightCm: 160 }), CFG)).toBe(true);
  });

  it("hiányzó deszkahossz → semleges 0,5, és nincs hossz-indoklás", () => {
    const inputs = makeInputs();
    expect(lengthFitScore(makeBoard({ lengthCm: null }), inputs, CFG)).toBe(0.5);
    const { reasons } = scoreBoard(makeBoard({ lengthCm: null }), inputs, CFG);
    expect(reasons.map((r) => r.key)).not.toContain("reason.length");
  });
});

describe("explainNoMatch — miért nincs találat", () => {
  it("terhelhetőség-korlátnál azt jelöli meg (biztonsági ok)", () => {
    const boards = [makeBoard({ maxLoadKg: 100 })];
    expect(explainNoMatch(boards, makeInputs({ weightKg: 95 }), CFG)).toBe("maxLoad");
  });

  it("árkeretnél a budgetet — de CSAK ha tényleg az a szűk keresztmetszet", () => {
    const boards = [makeBoard({ priceHuf: 900000 })];
    expect(explainNoMatch(boards, makeInputs({ budgetHuf: 100000 }), CFG)).toBe("budget");
  });

  it("a csak-felfújható megkötésnél a tárolást", () => {
    const boards = [makeBoard({ inflatable: false })];
    expect(explainNoMatch(boards, makeInputs({ storage: "inflatable_only" }), CFG)).toBe(
      "storage",
    );
  });

  it("HU-elérhetőség hiányát is megnevezi", () => {
    const boards = [makeBoard({ availabilityHu: false })];
    expect(explainNoMatch(boards, makeInputs(), CFG)).toBe("availability");
  });

  it("üres katalógusnál nem tippel a felhasználó beállításaira", () => {
    expect(explainNoMatch([], makeInputs(), CFG)).toBe("noBoards");
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

describe("passenger: felnőtt társ (F1.6-utó/3)", () => {
  it("a felnőtt társ a legnagyobb súly-többletet adja (összsúly a mérvadó)", () => {
    const alone = effectiveWeight(makeInputs({ passenger: "none" }), CFG);
    const child = effectiveWeight(makeInputs({ passenger: "child" }), CFG);
    const dog = effectiveWeight(makeInputs({ passenger: "dog" }), CFG);
    const adult = effectiveWeight(makeInputs({ passenger: "adult" }), CFG);

    expect(child - alone).toBe(CFG.passenger.childKg);
    expect(dog - alone).toBe(CFG.passenger.dogKg);
    expect(adult - alone).toBe(CFG.passenger.adultKg);
    expect(adult).toBeGreaterThan(dog);
  });

  it("felnőtt társsal a terhelhetőség-szűrő szigorúbb lesz", () => {
    // 80 kg + 70 kg társ = 150 kg effektív → 130 kg-os deszka kiesik.
    const board = makeBoard({ maxLoadKg: 130 });
    expect(passesHardFilter(board, makeInputs({ passenger: "none" }), CFG)).toBe(true);
    expect(passesHardFilter(board, makeInputs({ passenger: "adult" }), CFG)).toBe(false);
  });
});
