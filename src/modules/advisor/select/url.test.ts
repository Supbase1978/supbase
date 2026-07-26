/**
 * Az URL↔válaszok kódolás tesztjei. Ez a réteg dönti el, hogy egy MEGOSZTOTT
 * link ugyanazt az eredményt adja-e — és hogy egy elrontott/kézzel írt URL
 * nem borítja-e fel az ajánlót.
 */
import { describe, expect, it } from "vitest";

import type { AdvisorInputs } from "./types";
import { HEIGHT_RANGE, inputsFromSearchParams, searchParamsFromInputs, WEIGHT_RANGE } from "./url";

function inputs(over: Partial<AdvisorInputs> = {}): AdvisorInputs {
  return {
    weightKg: 85,
    heightCm: 180,
    passenger: "none",
    experience: "kezdo",
    use: "allround",
    water: "to",
    budgetHuf: 400000,
    storage: "any",
    ...over,
  };
}

describe("URL ↔ wizard-válaszok", () => {
  it("oda-vissza kódolás megőrzi az összes választ", () => {
    const original = inputs({ passenger: "adult", experience: "halado", use: "tura" });
    const restored = inputsFromSearchParams(searchParamsFromInputs(original));
    expect(restored).toEqual(original);
  });

  it("a null mezők KIMARADNAK az URL-ből (nem `keret=null`)", () => {
    const params = searchParamsFromInputs(inputs({ budgetHuf: null, heightCm: null }));
    expect(params.has("keret")).toBe(false);
    expect(params.has("magassag")).toBe(false);
    // …és visszaolvasva is null marad, nem 0.
    expect(inputsFromSearchParams(params)?.budgetHuf).toBeNull();
    expect(inputsFromSearchParams(params)?.heightCm).toBeNull();
  });

  it("testsúly nélkül NINCS eredmény — a route ilyenkor a wizardot mutatja", () => {
    expect(inputsFromSearchParams(new URLSearchParams(""))).toBeNull();
    expect(inputsFromSearchParams(new URLSearchParams("magassag=180"))).toBeNull();
  });

  it.each([
    ["nem szám", "suly=abc"],
    ["túl kicsi", `suly=${WEIGHT_RANGE.min - 1}`],
    ["túl nagy", `suly=${WEIGHT_RANGE.max + 1}`],
    ["negatív", "suly=-80"],
  ])("érvénytelen testsúly (%s) → wizard, nem hibás ajánlás", (_label, query) => {
    expect(inputsFromSearchParams(new URLSearchParams(query))).toBeNull();
  });

  it("a tartományon kívüli magasság null lesz (nem zárja ki az ajánlást)", () => {
    const tooTall = inputsFromSearchParams(
      new URLSearchParams(`suly=85&magassag=${HEIGHT_RANGE.max + 10}`),
    );
    expect(tooTall?.heightCm).toBeNull();
    expect(tooTall?.weightKg).toBe(85);
  });

  it("ismeretlen felsorolás-érték a JÓZAN ALAPÉRTÉKRE esik vissza", () => {
    // Egy megosztott linkből könnyen kimaradhat vagy elromolhat egy paraméter —
    // ilyenkor sem szabad hibázni.
    const parsed = inputsFromSearchParams(
      new URLSearchParams("suly=85&szint=profi&cel=repules&viz=lava&utas=sarkany"),
    );
    expect(parsed).toMatchObject({
      experience: "kezdo",
      use: "allround",
      water: "to",
      passenger: "none",
    });
  });

  it("a paraméter-nevek stabilak (a megosztott linkek nem törhetnek el)", () => {
    const params = searchParamsFromInputs(inputs());
    expect([...params.keys()].sort()).toEqual([
      "cel",
      "keret",
      "magassag",
      "suly",
      "szint",
      "tarolas",
      "utas",
      "viz",
    ]);
  });
});
