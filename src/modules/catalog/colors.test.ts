import { describe, expect, it } from "vitest";

import { MAX_COLORS, mergeColors, parseColorsInput } from "./colors";

describe("parseColorsInput", () => {
  it("vessző mentén vág, trimmel, az üreset eldobja", () => {
    expect(parseColorsInput(" Cruise Red , ,Cruise Blue,")).toEqual(["Cruise Red", "Cruise Blue"]);
  });

  it("a túl hosszú elemet eldobja, a darabszámot korlátozza", () => {
    expect(parseColorsInput(`${"x".repeat(41)}, Gecko`)).toEqual(["Gecko"]);
    const many = Array.from({ length: 20 }, (_, i) => `c${i}`).join(",");
    expect(parseColorsInput(many)).toHaveLength(MAX_COLORS);
  });
});

describe("mergeColors", () => {
  it("hozzáfűz, az eredeti sorrendet és írásmódot megőrzi", () => {
    expect(mergeColors(["Cruise Red"], ["Cruise Blue"])).toEqual(["Cruise Red", "Cruise Blue"]);
  });

  it("kis-/nagybetű-függetlenül szűri a duplikátumot", () => {
    expect(mergeColors(["Cruise Red"], ["cruise red", "Gecko", "GECKO"])).toEqual([
      "Cruise Red",
      "Gecko",
    ]);
  });

  it("null/üres meglévő listával is működik", () => {
    expect(mergeColors(null, [" Gecko "])).toEqual(["Gecko"]);
  });
});
