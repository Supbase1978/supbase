import { describe, expect, it } from "vitest";

import { slugify } from "./slug";

describe("slugify", () => {
  it("kisbetűsít, ékezetet hajt, nem-alfanumerikust kötőjelre cserél", () => {
    expect(slugify("SUP Balaton Kölcsönző")).toBe("sup-balaton-kolcsonzo");
  });

  it("levágja a vezető/záró kötőjeleket és összevonja a szeparátorokat", () => {
    expect(slugify("  Orfű  SUP & Kemping!! ")).toBe("orfu-sup-kemping");
  });

  it("üres/tisztán szimbólum-névre üres stringet ad (a hívó pótol)", () => {
    expect(slugify("---")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("legfeljebb 60 karakter", () => {
    expect(slugify("a".repeat(100)).length).toBe(60);
  });
});
