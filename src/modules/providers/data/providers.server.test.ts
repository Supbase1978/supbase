import { describe, expect, it } from "vitest";

import { safeExternalUrl, slugify, sortProvidersForList } from "./providers.server";

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

describe("safeExternalUrl", () => {
  it("engedi a http/https URL-t (normalizálva)", () => {
    expect(safeExternalUrl("https://balazssup.hu")).toBe("https://balazssup.hu/");
    expect(safeExternalUrl("  http://example.com/path  ")).toBe("http://example.com/path");
  });

  it("elutasítja a javascript:/data: sémát (stored XSS ellen)", () => {
    expect(safeExternalUrl("javascript:alert(document.cookie)")).toBeNull();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("elutasítja az érvénytelen / séma nélküli / üres értéket", () => {
    expect(safeExternalUrl("nem-egy-url")).toBeNull();
    expect(safeExternalUrl("ftp://example.com")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });
});

describe("sortProvidersForList", () => {
  it("a kiemelt (premium) szolgáltató elöl, azon belül név szerint", () => {
    const rows = [
      { tier: "free" as const, name: "Zeta" },
      { tier: "premium" as const, name: "Béta" },
      { tier: "free" as const, name: "Alfa" },
      { tier: "premium" as const, name: "Aqua" },
    ];
    expect(sortProvidersForList(rows).map((r) => r.name)).toEqual([
      "Aqua",
      "Béta",
      "Alfa",
      "Zeta",
    ]);
  });

  it("nem mutálja a bemenetet", () => {
    const rows = [
      { tier: "free" as const, name: "B" },
      { tier: "premium" as const, name: "A" },
    ];
    const snapshot = [...rows];
    sortProvidersForList(rows);
    expect(rows).toEqual(snapshot);
  });
});
