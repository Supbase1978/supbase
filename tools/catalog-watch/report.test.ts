import { describe, expect, it } from "vitest";

import {
  formatIncompleteReport,
  formatIncompleteReportHtml,
  looksLikeNonBoardModel,
  missingSpecLabels,
} from "./report.ts";

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

  it("a skipped (nem valódi deszka) tételek külön szakaszban jelennek meg, ha vannak", () => {
    const report = formatIncompleteReport(
      [],
      [],
      [{ source: "Aqua Marina Hungary", model: "AQUA MARINA Laxo kajak", missing: [], ref: "https://x.dev/laxo" }],
    );
    expect(report).toContain("KIHAGYVA (1)");
    expect(report).toContain("AQUA MARINA Laxo kajak");
  });

  it("skipped nélkül nem jelenik meg a KIHAGYVA szakasz", () => {
    const report = formatIncompleteReport([], []);
    expect(report).not.toContain("KIHAGYVA");
  });
});

describe("looksLikeNonBoardModel", () => {
  it.each([
    ["AQUA MARINA Laxo felfújható kajak", true],
    ["Aqua Marina Biztonsági kötél SURF 9'", true],
    ["Too Much hordozópánt vállpánttal", true],
    ["Aqua Marina Center Fin", true],
    ["Aqua Marina Carbon Pro lapát", true],
    ["Aqua Marina ISLAND vízi platform", true],
    ["IFISH 2 Gyerek horgászbot", true],
    ["Aqua Marina Monster", false],
    ["TooMuch Wave Explorer 10'6\"", false],
    ["Bluefin Tandem", false],
  ])("%s → %s", (model, expected) => {
    expect(looksLikeNonBoardModel(model)).toBe(expected);
  });
});

describe("formatIncompleteReportHtml", () => {
  const OPTS = { generatedAt: "2026-08-16" };

  it("önálló, jól formázott HTML dokumentumot ad, checkbox-okkal minden sorhoz", () => {
    const html = formatIncompleteReportHtml(
      [{ source: "sup-deszka.hu", model: "Wave Explorer", missing: ["hossz"], ref: "https://sup-deszka.hu/t/wave-explorer/" }],
      [{ source: "Bluefin", model: "Tandem", missing: ["teherbírás"], ref: "tandem" }],
      [{ source: "Aqua Marina Hungary", model: "Laxo kajak", missing: [], ref: "https://x.dev/laxo" }],
      OPTS,
    );
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("2026-08-16");
    expect(html).toContain("Wave Explorer");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Tandem");
    expect(html).toContain("Laxo kajak");
    // Nincs külső erőforrás (önálló fájl, böngészőben közvetlenül megnyitható).
    expect(html).not.toContain("http://cdn");
    expect(html).not.toMatch(/<link[^>]+href="https?:/);
  });

  it("HTML-escapel minden felhasználói eredetű szöveget (XSS-védelem, ha egy bolt neve furcsa karaktereket ad)", () => {
    const html = formatIncompleteReportHtml(
      [{ source: "<script>alert(1)</script>", model: "X & Y \"Z\"", missing: [], ref: "https://x.dev/y" }],
      [],
      [],
      OPTS,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("üres szakaszoknál 'nincs ilyen tétel' jelenik meg, nem üres táblázat", () => {
    const html = formatIncompleteReportHtml([], [], [], OPTS);
    expect(html).toContain("nincs ilyen tétel");
  });
});
