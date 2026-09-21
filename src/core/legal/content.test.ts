import { describe, expect, it } from "vitest";

import { termsDocument } from "./content";
import { LEGAL_ENTITY } from "./entity";

/**
 * AZ IMPRESSZUM A KÖTELEZŐ ADATOKAT VISELI, és csak azokat.
 *
 * A mezők 2026-09-21-ig placeholderek voltak (`[KITÖLTENDŐ: …]`), és az
 * élesítés ezen múlt. A teszt két dolgot őriz: a placeholder ne kerülhessen
 * vissza észrevétlenül, és a NEM ÉRTELMEZHETŐ mező ne adjon csonka sort.
 */
function impresszumSorok(locale: "hu" | "en"): string[] {
  return termsDocument[locale].sections.flatMap((section) => section.paragraphs ?? []);
}

describe("impresszum", () => {
  it("egyetlen KITÖLTENDŐ placeholder sem maradt az entitás-adatokban", () => {
    for (const [field, value] of Object.entries(LEGAL_ENTITY)) {
      expect(String(value), field).not.toContain("KITÖLTENDŐ");
    }
  });

  it.each(["hu", "en"] as const)("%s: a kötelező azonosítók megjelennek", (locale) => {
    const text = impresszumSorok(locale).join("\n");
    expect(text).toContain(LEGAL_ENTITY.name);
    expect(text).toContain(LEGAL_ENTITY.seat);
    expect(text).toContain(LEGAL_ENTITY.taxNumber);
    expect(text).toContain(LEGAL_ENTITY.email);
  });

  it.each(["hu", "en"] as const)("%s: üres mezőhöz NEM készül csonka sor", (locale) => {
    // Egyéni vállalkozásnál nincs cégjegyzékszám (felhasználói adat) — a sor
    // ilyenkor kimarad, nem „Cégjegyzék-/nyilvántartási szám:" érték nélkül.
    const csonka = impresszumSorok(locale).filter((line) => /:\s*$/.test(line));
    expect(csonka).toEqual([]);
  });

  it("a Resend is szerepel az adatfeldolgozók közt", () => {
    // Éles e-mail-küldés (F1.10-06) — a GDPR-tájékoztatónak fel kell sorolnia.
    expect(LEGAL_ENTITY.dataProcessors).toContain("Resend");
  });
});
