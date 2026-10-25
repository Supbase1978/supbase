import { describe, expect, it } from "vitest";
import { planSpecFill, splitModelName, type SpecValues } from "./backfill-specs.ts";

const EMPTY: SpecValues = {
  lengthCm: null,
  widthCm: null,
  thicknessCm: null,
  volumeL: null,
  weightKg: null,
  maxLoadKg: null,
};

const TABLE = [
  ["Model", "11’2” x 31+” iGO", "10’8” x 33” iGO"],
  ["Rider Weight", "45-100 kg", "Deluxe: 45-120 kg\nDeluxe Wave: 45-85 kg"],
  ["Width", '31+" / 78.7+ cm', '33" / 83.8 cm'],
  ["Weight (Tolerance +/- 5%)", "9.7 kg", "Deluxe: 9.6 kg\nDeluxe Wave: 9.8 kg"],
];

describe("splitModelName", () => {
  it("méretet és kivitelt választ szét", () => {
    expect(splitModelName(`iGO 10'8" X 33" Deluxe Wave`)).toEqual({
      sizeKey: "10'8x33",
      construction: "Deluxe Wave",
    });
  });
  it("a 31+ és a göndör idézőjel is méret", () => {
    expect(splitModelName("iGO 11’2” X 31+” Deluxe Lite").sizeKey).toBe("11'2x31");
  });
  it("méret nélküli névre null", () => {
    expect(splitModelName("Kids Paddle").sizeKey).toBeNull();
  });
});

describe("planSpecFill", () => {
  it("kivitelre szűkítve tölti az üres mezőket", () => {
    expect(planSpecFill(`iGO 10'8" X 33" Deluxe Wave`, EMPTY, [TABLE])).toMatchObject({
      maxLoadKg: 85,
      weightKg: 9.8,
      widthCm: 83.8,
    });
  });
  it("meglévő értéket nem ír felül", () => {
    const current = { ...EMPTY, maxLoadKg: 77 };
    const fill = planSpecFill(`iGO 11'2" X 31+" Deluxe`, current, [TABLE]);
    expect(fill.maxLoadKg).toBeUndefined();
    expect(fill.weightKg).toBe(9.7);
    expect(fill.widthCm).toBe(78.7);
  });
  it("ismeretlen méretre üres", () => {
    expect(planSpecFill(`Foo 9'9" X 29"`, EMPTY, [TABLE])).toEqual({});
  });
});
