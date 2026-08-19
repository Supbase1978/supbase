import { describe, expect, it } from "vitest";

import { dedupeCandidates, isSameBoard, type DedupeCandidate } from "./dedupe.ts";
import { EMPTY_SPECS, type BoardSpecs, type ExtractedProduct } from "./types.ts";

function candidate(
  id: string,
  modelName: string,
  sourceKind: DedupeCandidate["sourceKind"],
  specs: Partial<BoardSpecs> = {},
  extra: Partial<ExtractedProduct> = {},
): DedupeCandidate {
  return {
    id,
    url: `https://example.com/${id}`,
    sourceKind,
    sourceName: sourceKind === "brand_site" ? "Gyártó" : "Bolt",
    extracted: {
      sourceUrl: `https://example.com/${id}`,
      brandName: "Aqua Marina",
      modelName,
      rawTitle: modelName,
      modelYear: null,
      priceHuf: null,
      inStock: null,
      imageUrl: null,
      boardType: null,
      accessoryType: null,
      specs: { ...EMPTY_SPECS, lengthCm: 320, ...specs },
      ...extra,
    },
  };
}

describe("isSameBoard", () => {
  it("az azonos nevű és méretű jelöltet ugyanannak veszi", () => {
    expect(isSameBoard(candidate("a", "Monster", "shop"), candidate("b", "Monster", "brand_site"))).toBe(
      true,
    );
  });

  it("a KÜLÖNBÖZŐ MÉRETŰ, azonos nevű deszkát NEM vonja össze", () => {
    // A 12'0" és a 10'8" GO két külön termék, pedig a nevük azonos.
    const long = candidate("a", "GO", "brand_site", { lengthCm: 365 });
    const short = candidate("b", "GO", "brand_site", { lengthCm: 325 });
    expect(isSameBoard(long, short)).toBe(false);
  });

  it("ismeretlen hossznál NEM von össze (nem találgatunk)", () => {
    const known = candidate("a", "Monster", "shop");
    const unknown = candidate("b", "Monster", "brand_site", { lengthCm: null });
    expect(isSameBoard(known, unknown)).toBe(false);
  });

  it("eltérő MÁRKÁNÁL nem von össze, akkor sem, ha a modellnév azonos", () => {
    const a = candidate("a", "Explorer", "shop");
    const b = candidate("b", "Explorer", "brand_site");
    b.extracted.brandName = "Starboard";
    expect(isSameBoard(a, b)).toBe(false);
  });
});

describe("dedupeCandidates — a gyártói név a hivatalos", () => {
  it("a GYÁRTÓI jelölt nyer a bolti ellenében", () => {
    // A tárolt modellnév MÁR tisztított (`cleanModelName` levágja a márkát, a
    // méretet, az évjáratot és a zaj-szavakat), ezért a bolti „Aqua Marina
    // MONSTER 12'0 ISUP 2024" is egyszerűen „Monster"-ként érkezik ide.
    const groups = dedupeCandidates([
      candidate("shop1", "Monster", "shop"),
      candidate("brand1", "Monster", "brand_site"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.winner.id).toBe("brand1");
    expect(groups[0]?.merged.map((m) => m.id)).toEqual(["shop1"]);
  });

  it("a nyertes HIÁNYZÓ mezőit a bolti lapról tölti", () => {
    const groups = dedupeCandidates([
      // A gyártónál nincs súly, a boltnál igen.
      candidate("brand1", "Monster", "brand_site", { weightKg: null, maxLoadKg: 150 }),
      candidate("shop1", "Monster", "shop", { weightKg: 9.5, maxLoadKg: 999 }),
    ]);
    expect(groups[0]?.winner.extracted.specs.weightKg).toBe(9.5);
    // A gyártó SAJÁT értékét viszont NEM írja felül a bolti.
    expect(groups[0]?.winner.extracted.specs.maxLoadKg).toBe(150);
    expect(groups[0]?.filledFields).toContain("weightKg");
  });

  it("a kategória-tippet is átveszi, ha a nyertesnek nincs", () => {
    const groups = dedupeCandidates([
      candidate("brand1", "Monster", "brand_site"),
      candidate("shop1", "Monster", "shop", {}, { boardType: "allround" }),
    ]);
    expect(groups[0]?.winner.extracted.boardType).toBe("allround");
  });

  it("két gyártói jelöltnél a TÖBB adatot tartalmazó nyer", () => {
    const groups = dedupeCandidates([
      candidate("a", "Monster", "brand_site", { weightKg: null, volumeL: null }),
      candidate("b", "Monster", "brand_site", { weightKg: 9.5, volumeL: 300 }),
    ]);
    expect(groups[0]?.winner.id).toBe("b");
  });

  it("három forrásból ugyanaz a deszka EGY csoport lesz", () => {
    const groups = dedupeCandidates([
      candidate("s1", "Monster", "shop"),
      candidate("s2", "Monster", "shop"),
      candidate("b1", "Monster", "brand_site"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.merged).toHaveLength(2);
  });

  it("a különböző deszkák külön csoportban maradnak", () => {
    const groups = dedupeCandidates([
      candidate("a", "Monster", "brand_site", { lengthCm: 365 }),
      candidate("b", "Vapor", "brand_site", { lengthCm: 320 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.merged.length === 0)).toBe(true);
  });

  it("ugyanaz a bemenet ugyanazt az eredményt adja (determinisztikus)", () => {
    const input = [
      candidate("b", "Monster", "brand_site"),
      candidate("a", "Monster", "brand_site"),
    ];
    const first = dedupeCandidates(input).map((g) => g.winner.id);
    const second = dedupeCandidates(input).map((g) => g.winner.id);
    expect(first).toEqual(second);
  });
});
