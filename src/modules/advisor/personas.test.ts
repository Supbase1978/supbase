import { describe, expect, it } from "vitest";

import enAdvisor from "./locales/en/advisor.json";
import huAdvisor from "./locales/hu/advisor.json";
import { ADVISOR_PERSONAS, findPersona, PERSONA_SLUGS } from "./personas";
import { inputsFromSearchParams, searchParamsFromInputs, WEIGHT_RANGE } from "./select/url";

const PERSONA_TEXT_KEYS = ["title", "seoTitle", "seoDescription", "lead", "tips"] as const;

describe("ADVISOR_PERSONAS", () => {
  it("minden slug egyedi és a PERSONA_SLUGS-szal egyezik", () => {
    const slugs = ADVISOR_PERSONAS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect([...slugs].sort()).toEqual([...PERSONA_SLUGS].sort());
  });

  it("a példa-bemenetek az elfogadott tartományban vannak", () => {
    for (const persona of ADVISOR_PERSONAS) {
      expect(persona.inputs.weightKg).toBeGreaterThanOrEqual(WEIGHT_RANGE.min);
      expect(persona.inputs.weightKg).toBeLessThanOrEqual(WEIGHT_RANGE.max);
    }
  });

  it("a példa-bemenet átmegy az URL-kódoláson (a landing erre a linkre mutat)", () => {
    for (const persona of ADVISOR_PERSONAS) {
      const params = searchParamsFromInputs(persona.inputs);
      expect(inputsFromSearchParams(params)).toEqual(persona.inputs);
    }
  });

  it.each([
    ["hu", huAdvisor],
    ["en", enAdvisor],
  ])("%s: minden persona-szöveg megvan", (_locale, bundle) => {
    const persona = (bundle as unknown as { persona: Record<string, Record<string, unknown>> })
      .persona;
    for (const slug of PERSONA_SLUGS) {
      for (const key of PERSONA_TEXT_KEYS) {
        expect(persona[slug]?.[key], `${slug}.${key}`).toBeTruthy();
      }
      expect(Array.isArray(persona[slug]?.tips)).toBe(true);
    }
  });
});

describe("findPersona", () => {
  it("ismert slugra megtalálja, ismeretlenre null", () => {
    expect(findPersona("csaladi")?.slug).toBe("csaladi");
    expect(findPersona("nincs-ilyen")).toBeNull();
    expect(findPersona(undefined)).toBeNull();
  });
});
