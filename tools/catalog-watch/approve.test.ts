import { describe, expect, it } from "vitest";

import { buildBoardInsert } from "../../src/modules/catalog/data/candidates.server";
import { buildBoardInsertPayload } from "./approve.ts";
import { EMPTY_SPECS, type ExtractedProduct } from "./types.ts";

/**
 * ŐRSZEM-TESZT az elcsúszás ellen.
 *
 * A CLI sima `node`-dal fut, ahol a `@core/*` alias nem oldódik fel, ezért a
 * jóváhagyás payloadjából MÁSOLAT él a `tools/`-ban. Ez a teszt vitest alatt
 * fut, ahol az alias FELOLDÓDIK — így be tudja tölteni az app-oldali eredetit,
 * és mezőről mezőre összeveti a kettőt. Ha az app-oldali `buildBoardInsert`
 * változik (új oszlop, más kerekítés) és a másolat nem, ez a teszt elhasal.
 */
describe("buildBoardInsertPayload — egyezik az app-oldali buildBoardInsert-tel", () => {
  const extracted: ExtractedProduct = {
    sourceUrl: "https://star-board.com/products/x?variant=1",
    brandName: "Starboard",
    modelName: `iGO 11'2" X 32"`,
    rawTitle: `iGO Inflatable Paddleboard 11'2" X 32"`,
    modelYear: 2026,
    priceHuf: null,
    inStock: true,
    imageUrl: "https://star-board.com/kep.jpg",
    boardType: "allround",
    accessoryType: null,
    specs: {
      ...EMPTY_SPECS,
      lengthCm: 340.4,
      widthCm: 81.3,
      thicknessCm: 15,
      volumeL: 295.6,
      weightKg: 9.7,
      maxLoadKg: 120.4,
      inflatable: true,
    },
  };
  const options = {
    brandId: "11111111-1111-1111-1111-111111111111",
    boardType: "allround" as const,
    slug: "starboard-igo-11-2",
    seenAt: "2026-08-19T10:00:00.000Z",
  };

  it("azonos payloadot ad ugyanarra a bemenetre", () => {
    expect(buildBoardInsertPayload(extracted, options)).toEqual(
      buildBoardInsert(extracted, options),
    );
  });

  it("hiányzó mezőkkel is azonos (a null-ok kezelése sem csúszhat el)", () => {
    const sparse: ExtractedProduct = {
      ...extracted,
      modelName: "",
      modelYear: null,
      inStock: null,
      imageUrl: null,
      specs: { ...EMPTY_SPECS, inflatable: null },
    };
    expect(buildBoardInsertPayload(sparse, options)).toEqual(buildBoardInsert(sparse, options));
  });
});
