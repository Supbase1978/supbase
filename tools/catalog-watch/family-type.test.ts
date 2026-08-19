import { describe, expect, it } from "vitest";

import { buildFamilyTypeMap, familyKey, inferBoardType } from "./family-type.ts";

describe("familyKey", () => {
  it("a méretet és a kivitelt levágja, a család nevét tartja meg", () => {
    expect(familyKey("Starboard", `All Star 14'0" X 24.5" Wood Carbon`)).toBe("starboard|all star");
  });

  it("márka nélkül nincs kulcs (két gyártó ugyanazt a nevet használhatja)", () => {
    expect(familyKey(null, "All Star")).toBeNull();
  });

  it("csak számokból álló névre sincs kulcs", () => {
    expect(familyKey("Starboard", `14'0"`)).toBeNull();
  });
});

describe("buildFamilyTypeMap / inferBoardType", () => {
  it("a család egy tagjának kategóriáját a többi is megkapja", () => {
    // Élesben: a 2027-es All Star kollekcióból kapta a `race`-t, a 2024-es
    // ugyanaz a deszka kategória nélkül maradt.
    const { byFamily } = buildFamilyTypeMap([
      { brandName: "Starboard", modelName: `All Star 14'0" X 20.5" CRS`, boardType: "race", trusted: true },
    ]);
    expect(inferBoardType(byFamily, "Starboard", `All Star 14'0" X 26" Wood Carbon`)).toBe("race");
  });

  it("ELTÉRŐ besorolású családnál NEM következtet (bizonytalan)", () => {
    const { byFamily, conflicts } = buildFamilyTypeMap([
      { brandName: "Starboard", modelName: "Junior 12'6", boardType: "kids", trusted: true },
      { brandName: "Starboard", modelName: "Junior 14'0", boardType: "race", trusted: true },
    ]);
    expect(conflicts.has("starboard|junior")).toBe(true);
    expect(inferBoardType(byFamily, "Starboard", "Junior 12'6")).toBeNull();
  });

  it("más MÁRKA azonos modellnevére nem szivárog át", () => {
    const { byFamily } = buildFamilyTypeMap([
      { brandName: "Starboard", modelName: "Explorer 12'6", boardType: "touring", trusted: true },
    ]);
    expect(inferBoardType(byFamily, "Aqua Marina", "Explorer 12'6")).toBeNull();
  });

  it("a NEM megbízható (bolti) tippet figyelmen kívül hagyja", () => {
    // Élesben: a sup-deszka.hu a Fusion címéből `kids`-et vezetett le, pedig
    // az allround deszka. Ha ez számítana, a család minden tagja kids lenne.
    const { byFamily } = buildFamilyTypeMap([
      { brandName: "Aqua Marina", modelName: "Fusion 10'10", boardType: "kids", trusted: false },
    ]);
    expect(inferBoardType(byFamily, "Aqua Marina", "Fusion")).toBeNull();
  });

  it("ismeretlen családra null", () => {
    const { byFamily } = buildFamilyTypeMap([]);
    expect(inferBoardType(byFamily, "Starboard", "Spice")).toBeNull();
  });

  it("a kategória nélküli példákat figyelmen kívül hagyja", () => {
    const { byFamily } = buildFamilyTypeMap([
      { brandName: "Starboard", modelName: "GO 11'2", boardType: null, trusted: true },
      { brandName: "Starboard", modelName: "GO 12'0", boardType: "allround", trusted: true },
    ]);
    expect(inferBoardType(byFamily, "Starboard", "GO 10'8")).toBe("allround");
  });
});
