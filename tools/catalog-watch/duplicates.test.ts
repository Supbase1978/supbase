import { describe, expect, it } from "vitest";

import { findDuplicateBoards, findUnpairedCandidates, nameKey } from "./duplicates.ts";
import type { CatalogBoard } from "./duplicates.ts";

function board(
  id: string,
  modelName: string,
  extra: Partial<CatalogBoard> = {},
): CatalogBoard {
  return {
    id,
    brandName: "Starboard",
    modelName,
    slug: `starboard-${id}`,
    filledFields: 7,
    imageCount: 5,
    ...extra,
  };
}

describe("nameKey", () => {
  it("a kis/nagybetű és az írásjel nem különböztet meg", () => {
    // Élesben ez volt a duplikátumok fele: a Starboard a 2024-es és a 2025-ös
    // lapon `X`-et és `x`-et ír ugyanarra a deszkára.
    expect(nameKey("Starboard", `Whopper 10'0" X 34" ASAP`)).toBe(
      nameKey("Starboard", `Whopper 10'0" x 34" ASAP`),
    );
  });

  it("a MÁRKA is része", () => {
    expect(nameKey("Zray", "Fury")).not.toBe(nameKey("Jobe", "Fury"));
  });
});

describe("findDuplicateBoards", () => {
  it("a több KITÖLTÖTT MEZŐT tartalmazó sor marad", () => {
    const groups = findDuplicateBoards([
      board("a", "Whopper", { filledFields: 6, imageCount: 9 }),
      board("b", "Whopper", { filledFields: 7, imageCount: 7 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.keep.id).toBe("b");
    expect(groups[0]?.drop.map((d) => d.id)).toEqual(["a"]);
  });

  it("azonos mezőszámnál a TÖBB KÉP dönt, utána a `-2` nélküli slug", () => {
    expect(
      findDuplicateBoards([
        board("a", "GO", { imageCount: 3 }),
        board("b", "GO", { imageCount: 6 }),
      ])[0]?.keep.id,
    ).toBe("b");
    expect(
      findDuplicateBoards([
        board("a", "GO", { slug: "starboard-go-2" }),
        board("b", "GO", { slug: "starboard-go" }),
      ])[0]?.keep.id,
    ).toBe("b");
  });

  it("egyedi nevekre üres", () => {
    expect(findDuplicateBoards([board("a", "GO"), board("b", "Whopper")])).toEqual([]);
  });

  it("kettőnél több példányt is kezel", () => {
    const groups = findDuplicateBoards([
      board("a", "SPRINT"),
      board("b", "SPRINT"),
      board("c", "SPRINT"),
    ]);
    expect(groups[0]?.drop).toHaveLength(2);
  });
});

describe("findUnpairedCandidates", () => {
  const live = [board("live", `Whopper 10'0" X 34" ASAP`)];

  it("megtalálja a párja NÉLKÜLI, azonos nevű jelöltet", () => {
    const found = findUnpairedCandidates(
      [{ id: "c1", brandName: "Starboard", modelName: `Whopper 10'0" x 34" ASAP`, matchedBoardId: null }],
      live,
    );
    expect(found).toEqual([
      { candidateId: "c1", label: `Starboard Whopper 10'0" x 34" ASAP`, boardId: "live" },
    ]);
  });

  it("a MÁR helyesen párosított jelöltet békén hagyja", () => {
    const found = findUnpairedCandidates(
      [{ id: "c1", brandName: "Starboard", modelName: `Whopper 10'0" X 34" ASAP`, matchedBoardId: "live" }],
      live,
    );
    expect(found).toEqual([]);
  });

  it("HASONLÓ, de nem azonos nevet NEM párosít", () => {
    // Élesben: az `iCON 12'0" X 33" Deluxe` 82%-kal az `iGO 12'0" X 33"
    // Deluxe`-ra illeszkedett — más modell. A szigorú egyezés ezt kizárja.
    const found = findUnpairedCandidates(
      [{ id: "c1", brandName: "Starboard", modelName: `iCON 12'0" X 33" Deluxe`, matchedBoardId: null }],
      [board("live2", `iGO 12'0" X 33" Deluxe`)],
    );
    expect(found).toEqual([]);
  });
});
