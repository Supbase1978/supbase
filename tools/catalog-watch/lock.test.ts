import { describe, expect, it } from "vitest";

import { applyFieldLocks } from "./lock.ts";
import type { ExtractedProduct } from "./types.ts";

function makeProduct(overrides: Partial<ExtractedProduct> = {}): ExtractedProduct {
  return {
    sourceUrl: "https://bolt.hu/x",
    brandName: "Aqua Marina",
    modelName: "Monster",
    rawTitle: "Aqua Marina Monster 366cm ISUP",
    modelYear: null,
    priceHuf: null,
    inStock: true,
    imageUrl: null,
    boardType: null,
    specs: {
      lengthCm: null,
      widthCm: null,
      thicknessCm: null,
      volumeL: null,
      weightKg: null,
      maxLoadKg: null,
      inflatable: true,
    },
    accessoryType: null,
    ...overrides,
  };
}

describe("applyFieldLocks", () => {
  it("üres locked_fields mellett az incoming változatlanul visszaadva (korábbi teljes felülírás, visszafelé kompatibilis)", () => {
    const existing = makeProduct({ specs: { ...makeProduct().specs, lengthCm: 366, widthCm: 84 } });
    const incoming = makeProduct({ specs: { ...makeProduct().specs, lengthCm: 84, widthCm: 15 } });
    const result = applyFieldLocks(existing, incoming, []);
    expect(result).toEqual(incoming);
  });

  it("zárolt specs-mező megőrzi a régi értéket, a zárolatlan mező az újat kapja", () => {
    // Élesben mért eset (2026-08-15): "SUP MEGA 18'1"" — a kézzel javított
    // lengthCm/widthCm-et egy közbenső crawl korábban visszaírta null-ra.
    const existing = makeProduct({
      specs: { ...makeProduct().specs, lengthCm: 550, widthCm: 152, maxLoadKg: 650 },
    });
    const incoming = makeProduct({
      specs: { ...makeProduct().specs, lengthCm: null, widthCm: null, maxLoadKg: null, volumeL: 500 },
    });
    const result = applyFieldLocks(existing, incoming, ["specs.lengthCm", "specs.widthCm"]);
    expect(result.specs.lengthCm).toBe(550);
    expect(result.specs.widthCm).toBe(152);
    // NEM zárolt mezők: az új (incoming) érték érvényesül.
    expect(result.specs.maxLoadKg).toBeNull();
    expect(result.specs.volumeL).toBe(500);
  });

  it("top-level (nem specs.) mező is zárolható, pl. brandName", () => {
    const existing = makeProduct({ brandName: "Aqua Marina" });
    const incoming = makeProduct({ brandName: null });
    const result = applyFieldLocks(existing, incoming, ["brandName"]);
    expect(result.brandName).toBe("Aqua Marina");
  });

  it("vegyes eset: néhány mező zárolt, néhány nem, mindkettő helyesen viselkedik", () => {
    const existing = makeProduct({
      brandName: "Aqua Marina",
      specs: { ...makeProduct().specs, lengthCm: 320, weightKg: 11.7 },
    });
    const incoming = makeProduct({
      brandName: "AQUA MARINA (rossz formázás)",
      priceHuf: 199000,
      specs: { ...makeProduct().specs, lengthCm: 84, weightKg: null, maxLoadKg: 150 },
    });
    const result = applyFieldLocks(existing, incoming, ["brandName", "specs.lengthCm"]);
    expect(result.brandName).toBe("Aqua Marina");
    expect(result.specs.lengthCm).toBe(320);
    // Zárolatlan mezők (weightKg is null lett — a zár csak a KIVÁLASZTOTT
    // mezőket védi, nem "ha bármi rosszabb lett, tartsd meg a régit"):
    expect(result.specs.weightKg).toBeNull();
    expect(result.specs.maxLoadKg).toBe(150);
    expect(result.priceHuf).toBe(199000);
  });
});
