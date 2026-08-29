/**
 * A spot → „alapinfo" víz leképezés regressziós hálója (F2.5-utó, 2026-08-29).
 *
 * MIÉRT KELL: a név-alapú ág SORRENDFÜGGŐ. A specifikus vizek nevében benne
 * van az általános víz neve is („Ráckevei-Duna" ⊃ „Duna", „Holt-Körös" ⊃
 * „Körös"), tehát ha egy általános minta kerül előre, a spot CSENDBEN a rossz
 * szabályoldalt kapja — a Ráckevei-Duna-ág a fővárosi Duna szabályait, holott
 * annak saját, korlátozásokkal teli rendje van. Ez nem stílushiba: a
 * szabályoldal az, amit a felhasználó vízre szállás előtt elolvas.
 */
import { describe, expect, it } from "vitest";

import {
  isWaterInfoSlug,
  WATER_INFO_COUNTS,
  WATER_INFO_SLUGS,
  waterInfoSlugForSpot,
} from "./waterinfo";

describe("waterInfoSlugForSpot", () => {
  it.each([
    // Tavak: a viharjelzési körzet a megbízható jel.
    ["Balatonföldvár", "to", "Balaton", "balaton"],
    ["Agárd", "to", "Velencei-tó", "velencei-to"],
    ["Poroszló", "to", "Tisza-tó", "tisza-to"],
    ["Fertőrákos (Fertő)", "to", "Fertő", "ferto-to"],
    // Folyók: a spot NEVÉBŐL, a specifikus minták előbb.
    ["Ráckeve (Ráckevei-Duna)", "folyo", null, "rsd"],
    ["Gyomaendrőd (Hármas-Körös)", "folyo", null, "harmas-koros"],
    ["Szarvas (Holt-Körös)", "holtag", null, "harmas-koros"],
    ["Körös-torok (Csongrád)", "folyo", null, "harmas-koros"],
    ["Szentendre (Szentendrei-Duna)", "folyo", null, "duna"],
    ["Római-part (Duna)", "folyo", null, "duna"],
    ["Fadd-Dombori (Holt-Duna)", "holtag", null, "duna"],
    ["Szeged (Tisza)", "folyo", null, "tisza"],
    // Orfű: a spot a Pécsi-tavon van, a szabályoldal viszont mindkét tóról szól.
    ["Orfű (Pécsi-tó)", "to", null, "orfu"],
  ] as const)("%s → %s", (name, waterType, region, expected) => {
    expect(
      waterInfoSlugForSpot({ name, waterType, stormWarningRegion: region }),
    ).toBe(expected);
  });

  it("a Ráckevei-Duna NEM a fővárosi Duna szabályait kapja", () => {
    // A legdrágább elrontható eset: a „Duna" minta részstringként illeszkedne.
    expect(
      waterInfoSlugForSpot({
        name: "Ráckeve (Ráckevei-Duna)",
        waterType: "folyo",
        stormWarningRegion: null,
      }),
    ).not.toBe("duna");
  });

  it("ismeretlen vízre null — nem tippel szabályoldalt", () => {
    expect(
      waterInfoSlugForSpot({
        name: "Gyékényesi-tó",
        waterType: "to",
        stormWarningRegion: null,
      }),
    ).toBeNull();
  });

  it("a tó-név nem visz folyó-szabályoldalra", () => {
    // A `folyo`/`holtag` kapu nélkül egy „Duna" nevű bányató is a Duna
    // szabályait kapná.
    expect(
      waterInfoSlugForSpot({
        name: "Duna-parti bányató",
        waterType: "to",
        stormWarningRegion: null,
      }),
    ).toBeNull();
  });
});

describe("a vízlista és az elemszámok együtt maradnak", () => {
  it("minden slug felismerhető, és van hozzá elemszám", () => {
    for (const slug of WATER_INFO_SLUGS) {
      expect(isWaterInfoSlug(slug)).toBe(true);
      expect(WATER_INFO_COUNTS[slug]).toBeDefined();
    }
    expect(Object.keys(WATER_INFO_COUNTS)).toHaveLength(WATER_INFO_SLUGS.length);
  });

  it("ismeretlen slug nem víz", () => {
    expect(isWaterInfoSlug("nincs-ilyen")).toBe(false);
  });
});
