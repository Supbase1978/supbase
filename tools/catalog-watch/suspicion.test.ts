import { describe, expect, it } from "vitest";

import {
  fieldCoverage,
  findSuspicions,
  formatCoverage,
  volumeGeometryRatio,
} from "./suspicion.ts";
import { EMPTY_SPECS, type BoardSpecs, type BoardType, type ExtractedProduct } from "./types.ts";

function board(
  specs: Partial<BoardSpecs>,
  overrides: Partial<ExtractedProduct> = {},
): ExtractedProduct {
  return {
    sourceUrl: "https://gyarto.example/deszka",
    brandName: "Teszt",
    modelName: "Modell",
    rawTitle: "Teszt Modell",
    modelYear: null,
    priceHuf: null,
    inStock: null,
    imageUrl: null,
    boardType: "allround" as BoardType,
    specs: { ...EMPTY_SPECS, ...specs },
    accessoryType: null,
    ...overrides,
  };
}

describe("volumeGeometryRatio", () => {
  it("hiányzó mezőnél nem számol (nem találgat)", () => {
    expect(volumeGeometryRatio({ ...EMPTY_SPECS, volumeL: 300 })).toBeNull();
    expect(
      volumeGeometryRatio({ ...EMPTY_SPECS, lengthCm: 340, widthCm: 81, thicknessCm: 15 }),
    ).toBeNull();
  });

  it("a mért sávot adja vissza a valós deszkákra", () => {
    // Sprint 14'0" Zero — a katalógus LEGALACSONYABB aránya (hegyes orr/far).
    expect(volumeGeometryRatio(
      { ...EMPTY_SPECS, lengthCm: 427, widthCm: 60, thicknessCm: 27, volumeL: 248 },
    )).toBeCloseTo(0.36, 2);
    // Peace jógadeszka — a LEGMAGASABB (szinte téglatest).
    expect(volumeGeometryRatio(
      { ...EMPTY_SPECS, lengthCm: 249, widthCm: 90, thicknessCm: 15, volumeL: 340 },
    )).toBeCloseTo(1.01, 2);
  });
});

describe("findSuspicions — a VALÓS deszkák átmennek", () => {
  // Ez a blokk a hamis riasztás ellen véd. Ha egy jövőbeli szigorítás legitim
  // deszkát kezdene gyanúsítani, ITT bukik el — a katalógus tényleges
  // szélsőértékein, nem kitalált példákon.
  it.each<[string, ExtractedProduct]>([
    [
      "Sprint 14'0\" — a legkarcsúbb versenydeszka",
      board({ lengthCm: 427, widthCm: 60, thicknessCm: 27, volumeL: 248, maxLoadKg: 120 }, {
        boardType: "race",
      }),
    ],
    [
      "Peace — a legzömökebb jógadeszka, és a legrövidebb nem-gyerek",
      board({ lengthCm: 249, widthCm: 90, thicknessCm: 15, volumeL: 340, maxLoadKg: 150 }, {
        boardType: "yoga",
      }),
    ],
    [
      "Kids Navy K8 A — a legrövidebb deszka a katalógusban",
      board({ lengthCm: 244, widthCm: 76, thicknessCm: 12, volumeL: 156, maxLoadKg: 55 }, {
        boardType: "kids",
      }),
    ],
    [
      "Mega — a legnagyobb (többszemélyes)",
      board({ lengthCm: 551, widthCm: 153, thicknessCm: 20, volumeL: 1400, maxLoadKg: 650 }),
    ],
    [
      "Cruise Gecko — a gyártó nem közöl űrtartalmat",
      board({ lengthCm: 325, widthCm: 82, thicknessCm: 16, volumeL: null, maxLoadKg: 150 }),
    ],
  ])("%s", (_name, product) => {
    expect(findSuspicions(product)).toEqual([]);
  });
});

describe("findSuspicions — az ÉLESBEN MÉRT hibák fennakadnak", () => {
  it("a saját méreteivel összeférhetetlen űrtartalom", () => {
    // sup-deszka.hu, HYPER 11'6": 350×79×15 = 415 L doboz, 48 L állítás.
    const found = findSuspicions(
      board({ lengthCm: 350, widthCm: 79, thicknessCm: 15, volumeL: 48, maxLoadKg: 150 }),
    );
    expect(found.map((s) => s.code)).toEqual(["volume_geometry"]);
    expect(found[0]?.detail).toContain("0.12");
  });

  it("a befoglaló doboznál NAGYOBB űrtartalom is gyanús (fizikai korlát)", () => {
    const found = findSuspicions(
      board({ lengthCm: 300, widthCm: 80, thicknessCm: 10, volumeL: 400 }),
    );
    expect(found.map((s) => s.code)).toContain("volume_geometry");
  });

  it("a nem-gyerek deszka nem lehet 240 cm alatt", () => {
    // aquamarinahungary.com, BREEZE: az ÁLLÍTHATÓ EVEZŐ 165-210 cm-éből
    // származó hossz, allround kategóriával.
    const found = findSuspicions(board({ lengthCm: 210, widthCm: 76, thicknessCm: 12 }));
    expect(found.map((s) => s.code)).toEqual(["too_short"]);
  });

  it("UGYANAZ a hossz gyerekdeszkaként NEM gyanús", () => {
    // A felhasználó pontosítása: a gyerekméretre a gyártó mindig utal, tehát
    // a kategória a kontextus — nem a szám önmagában dönt.
    expect(
      findSuspicions(
        board({ lengthCm: 210, widthCm: 76, thicknessCm: 12 }, { boardType: "kids" }),
      ),
    ).toEqual([]);
  });

  it("a deszka súlya nem teherbírás", () => {
    // sup-deszka.hu, Pure Air FREEDOM: 8,8 kg került a teherbírásba.
    const found = findSuspicions(
      board({ lengthCm: 335, widthCm: 84, thicknessCm: 15, maxLoadKg: 8.8 }),
    );
    expect(found.map((s) => s.code)).toEqual(["implausible_load"]);
  });

  it("KIEGÉSZÍTŐRE egyik küszöb sem fut", () => {
    // Egy uszony 18 cm — deszkaként minden jel megszólalna.
    expect(
      findSuspicions(
        board({ lengthCm: 18, maxLoadKg: null }, { accessoryType: "uszony", boardType: null }),
      ),
    ).toEqual([]);
  });
});

describe("findSuspicions — ütközés a MÁR ISMERT deszkával", () => {
  const known = { modelName: "Breeze", lengthCm: 300, volumeL: 229, maxLoadKg: 100 };

  it("nagyságrendi eltérés BIZTOS egyezésnél gyanús", () => {
    const found = findSuspicions(board({ lengthCm: 210 }, { boardType: "kids" }), {
      board: known,
      confidence: 0.92,
    });
    expect(found.map((s) => s.code)).toEqual(["conflicts_with_board"]);
    expect(found[0]?.detail).toContain("Breeze");
  });

  it("BIZONYTALAN egyezésnél hallgat — ott az eltérés MÁS terméket jelenthet", () => {
    expect(
      findSuspicions(board({ lengthCm: 210 }, { boardType: "kids" }), {
        board: known,
        confidence: 0.5,
      }),
    ).toEqual([]);
  });

  it("a kerekítésnyi eltérés nem ütközés", () => {
    expect(
      findSuspicions(board({ lengthCm: 305 }, { boardType: "kids" }), {
        board: known,
        confidence: 0.95,
      }),
    ).toEqual([]);
  });
});

describe("fieldCoverage", () => {
  const products = [
    board({ lengthCm: 340, widthCm: 81, thicknessCm: 15, volumeL: 300, maxLoadKg: 150 }),
    board({ lengthCm: 320, widthCm: 80, thicknessCm: 15, volumeL: null, maxLoadKg: 140 }),
  ];

  it("mezőnként számol, és a KIEGÉSZÍTŐT kihagyja", () => {
    const withAccessory = [...products, board({ lengthCm: 18 }, { accessoryType: "uszony" })];
    const coverage = fieldCoverage(withAccessory);
    expect(coverage.find((c) => c.field === "lengthCm")).toMatchObject({
      withValue: 2,
      total: 2,
    });
    expect(coverage.find((c) => c.field === "volumeL")).toMatchObject({
      withValue: 1,
      total: 2,
    });
  });

  it("a NEM KÖZÖLT mező várt hiány, nem anomália", () => {
    const coverage = fieldCoverage(products, ["volumeL"]);
    expect(coverage.find((c) => c.field === "volumeL")?.unpublished).toBe(true);
    expect(formatCoverage(coverage)).toContain("térf n.a.");
    expect(formatCoverage(coverage)).not.toContain("térf 1/2");
  });

  it("a teljes mező egy szó, a hiányos a darabszámmal áll", () => {
    const text = formatCoverage(fieldCoverage(products));
    expect(text).toContain("hossz ✓");
    expect(text).toContain("térf 1/2");
  });
});
