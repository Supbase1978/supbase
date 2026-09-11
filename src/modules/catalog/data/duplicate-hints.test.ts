import { describe, expect, it } from "vitest";

import { DUPLICATE_HINT_THRESHOLD, findDuplicateHints } from "./duplicate-hints";

describe("findDuplicateHints", () => {
  it("valós forrásközi párt talál (2026-08-13 élesben mért eset)", () => {
    const hints = findDuplicateHints([
      {
        id: "a",
        sourceId: "aqua-marina-hungary",
        brandName: "Aqua Marina",
        modelName: "Fusion BT 23FUP",
        modelYear: null,
        accessoryType: null,
      },
      {
        id: "b",
        sourceId: "sup-deszka",
        brandName: "Aqua Marina",
        modelName: "FUSION BT 23FUP -62%",
        modelYear: null,
        accessoryType: null,
      },
    ]);

    expect(hints.get("a")?.candidateId).toBe("b");
    expect(hints.get("b")?.candidateId).toBe("a");
    expect(hints.get("a")?.score).toBeGreaterThanOrEqual(DUPLICATE_HINT_THRESHOLD);
  });

  /**
   * ÉLESBEN MÉRT (star-board.com, 2026-09-10): a gyártó ugyanazt a deszkát a
   * `2024-`, `2025-` és `2026-` termékoldalon is árulja, azonos modellnévvel,
   * mérettel és kivitellel. A korábbi szabály („azonos forrásból sosem")
   * emiatt elnémította a jelzést, a moderátor két Whoppert párhuzamosan
   * jóváhagyott, és moderátori jegyzet lett belőle.
   */
  it("azonos forrásból is ad gyanút, ha a modellnév TELJESEN azonos", () => {
    const hints = findDuplicateHints([
      {
        id: "a",
        sourceId: "starboard",
        brandName: "Starboard",
        modelName: `Whopper 10'0" X 34" ASAP`,
        modelYear: 2024,
        accessoryType: null,
      },
      {
        id: "b",
        sourceId: "starboard",
        brandName: "Starboard",
        modelName: `Whopper 10'0" x 34" ASAP`, // a gyártó évjáratonként mást ír
        modelYear: 2025,
        accessoryType: null,
      },
    ]);

    expect(hints.get("a")?.candidateId).toBe("b");
    expect(hints.get("b")?.candidateId).toBe("a");
  });

  it("azonos forráson belül a PUSZTA HASONLÓSÁG nem elég — a szomszéd méret nem duplikátum", () => {
    const hints = findDuplicateHints([
      {
        id: "a",
        sourceId: "starboard",
        brandName: "Starboard",
        modelName: `Whopper 10'0" X 34" ASAP`,
        modelYear: 2025,
        accessoryType: null,
      },
      {
        id: "b",
        sourceId: "starboard",
        brandName: "Starboard",
        modelName: `Whopper 11'0" X 36" ASAP`,
        modelYear: 2025,
        accessoryType: null,
      },
    ]);

    expect(hints.size).toBe(0);
  });

  it("deszka SOSEM párosul kiegészítővel, még azonos márka/névtöredék esetén sem", () => {
    const hints = findDuplicateHints([
      {
        id: "board",
        sourceId: "aqua-marina-hungary",
        brandName: "Aqua Marina",
        modelName: "Carbon Pro",
        modelYear: null,
        accessoryType: null,
      },
      {
        id: "paddle",
        sourceId: "sup-deszka",
        brandName: "Aqua Marina",
        modelName: "Carbon Pro evező",
        modelYear: null,
        accessoryType: "evezo",
      },
    ]);

    expect(hints.size).toBe(0);
  });

  it("eltérő kiegészítő-kategória sem párosul, csak azonos kategórián belül", () => {
    const hints = findDuplicateHints([
      {
        id: "pump",
        sourceId: "aqua-marina-hungary",
        brandName: "Aqua Marina",
        modelName: "Elektromos pumpa 12V 16 psi",
        modelYear: null,
        accessoryType: "pumpa",
      },
      {
        id: "vest",
        sourceId: "sup-deszka",
        brandName: "Aqua Marina",
        modelName: "Elektromos mentőmellény",
        modelYear: null,
        accessoryType: "mentomelleny",
      },
    ]);

    expect(hints.size).toBe(0);
  });

  it("gyenge, zajos hasonlóságnál (küszöb alatt) nem ad gyanút", () => {
    const hints = findDuplicateHints([
      {
        id: "beast",
        sourceId: "aqua-marina-hungary",
        brandName: "Aqua Marina",
        modelName: "Beast BT 23BEP",
        modelYear: null,
        accessoryType: null,
      },
      {
        id: "dhyana",
        sourceId: "sup-deszka",
        brandName: "Aqua Marina",
        modelName: "Dhyana BT 23DHP",
        modelYear: null,
        accessoryType: null,
      },
    ]);

    expect(hints.size).toBe(0);
  });

  it("három forrásból a legerősebb párt választja, nem az elsőt", () => {
    const hints = findDuplicateHints([
      {
        id: "a",
        sourceId: "aqua-marina-hungary",
        brandName: "Aqua Marina",
        modelName: "Monster",
        modelYear: null,
        accessoryType: null,
      },
      {
        id: "b",
        sourceId: "sup-deszka",
        brandName: "Aqua Marina",
        modelName: "MONSTER , 170 kg BT 23MOP",
        modelYear: null,
        accessoryType: null,
      },
      {
        id: "c",
        sourceId: "indiana",
        brandName: "Indiana",
        modelName: "12'6 Touring Inflatable",
        modelYear: null,
        accessoryType: null,
      },
    ]);

    expect(hints.get("a")?.candidateId).toBe("b");
    expect(hints.has("c")).toBe(false);
  });
});
