import { describe, expect, it } from "vitest";

import { recommendGearFor } from "./deszkavalaszto.gear";

describe("recommendGearFor", () => {
  it("álló vízen, allround célnál csak póráz + mentőmellény (bokapóráz-szöveggel)", () => {
    const items = recommendGearFor({ water: "to", use: "allround", storage: "any" });
    expect(items).toEqual([
      { category: "poraz", textKey: "gear.advisor.leash.other" },
      { category: "mentomelleny", textKey: "gear.advisor.pfd" },
    ]);
  });

  it("folyón a póráz-tétel a derékpóráz-szöveget kapja", () => {
    const items = recommendGearFor({ water: "folyo", use: "allround", storage: "any" });
    expect(items[0]).toEqual({ category: "poraz", textKey: "gear.advisor.leash.river" });
  });

  it("felfújható preferenciánál (inflatable_only) megjelenik a pumpa", () => {
    const items = recommendGearFor({ water: "to", use: "allround", storage: "inflatable_only" });
    expect(items.some((i) => i.category === "pumpa")).toBe(true);
  });

  it("nem-felfújható preferenciánál (any) NEM jelenik meg a pumpa", () => {
    const items = recommendGearFor({ water: "to", use: "allround", storage: "any" });
    expect(items.some((i) => i.category === "pumpa")).toBe(false);
  });

  it("túra célnál megjelenik a szárazzsák", () => {
    const items = recommendGearFor({ water: "to", use: "tura", storage: "any" });
    expect(items.some((i) => i.category === "szarazzsak")).toBe(true);
  });

  it("nem-túra célnál NEM jelenik meg a szárazzsák", () => {
    const items = recommendGearFor({ water: "to", use: "verseny", storage: "any" });
    expect(items.some((i) => i.category === "szarazzsak")).toBe(false);
  });

  it("folyó + túra + felfújható: mind a négy tétel megjelenik", () => {
    const items = recommendGearFor({ water: "folyo", use: "tura", storage: "inflatable_only" });
    expect(items.map((i) => i.category)).toEqual(["poraz", "mentomelleny", "pumpa", "szarazzsak"]);
  });
});
