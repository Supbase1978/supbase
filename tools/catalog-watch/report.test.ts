import { describe, expect, it } from "vitest";

import { formatIncompleteReport, missingSpecLabels } from "./report.ts";

describe("missingSpecLabels", () => {
  const FULL = { lengthCm: 320, widthCm: 84, thicknessCm: 15, weightKg: 9.5, maxLoadKg: 150 };

  it("teljes specifikációra üres tömb", () => {
    expect(missingSpecLabels(FULL)).toEqual([]);
  });

  it("minden hiányzó mezőt magyar címkével sorol fel, a deklarált sorrendben", () => {
    expect(missingSpecLabels({ ...FULL, widthCm: null, maxLoadKg: null })).toEqual([
      "szélesség",
      "teherbírás",
    ]);
  });

  it("mind az öt mező hiánya mind az öt címkét adja", () => {
    expect(
      missingSpecLabels({ lengthCm: null, widthCm: null, thicknessCm: null, weightKg: null, maxLoadKg: null }),
    ).toEqual(["hossz", "szélesség", "vastagság", "súly", "teherbírás"]);
  });
});

describe("formatIncompleteReport", () => {
  it("üres bemenetre mindkét szakaszban jelzi, hogy nincs teendő", () => {
    const report = formatIncompleteReport([], []);
    expect(report).toContain("pending jelölt: 0, élő board: 0");
    expect(report).toContain("nincs ilyen — minden aktívan gyűjtött jelölt kész");
    expect(report).toContain("nincs ilyen — minden élő board adata teljes");
  });

  it("mindkét szakaszt helyesen listázza, a forrás/URL is szerepel", () => {
    const report = formatIncompleteReport(
      [{ source: "sup-deszka.hu", model: "Wave Explorer", missing: ["hossz", "szélesség"], ref: "https://sup-deszka.hu/t/wave-explorer/" }],
      [{ source: "Bluefin", model: "Tandem", missing: ["teherbírás"], ref: "tandem" }],
    );
    expect(report).toContain("[sup-deszka.hu] Wave Explorer — hiányzik: hossz, szélesség");
    expect(report).toContain("https://sup-deszka.hu/t/wave-explorer/");
    expect(report).toContain("[Bluefin] Tandem — hiányzik: teherbírás");
    expect(report).toContain("verify-specs --board tandem");
  });
});
