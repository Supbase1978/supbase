import { describe, expect, it } from "vitest";

import { GENERAL_STORM_SOURCE_URL, officialStormSourceUrl } from "./stormSourceUrl";

describe("officialStormSourceUrl", () => {
  it("Balaton → a met.hu balatoni viharjelzés-oldal", () => {
    expect(officialStormSourceUrl("Balaton")).toBe(
      "https://www.met.hu/idojaras/tavaink/balaton/viharjelzes/main.php",
    );
  });

  it("Fertő → a burgenlandi LSZ-oldal (MÁS üzemeltető, lásd README)", () => {
    expect(officialStormSourceUrl("Fertő")).toBe(
      "https://www.lsz-b.at/fuer-buergerinnen/sturmwarnung-webcams/",
    );
  });

  it("null régió → az általános met.hu tavaink-link", () => {
    expect(officialStormSourceUrl(null)).toBe(GENERAL_STORM_SOURCE_URL);
  });

  it("ismeretlen régió → az általános met.hu tavaink-link (fail-safe)", () => {
    expect(officialStormSourceUrl("Nem Létező Tó")).toBe(GENERAL_STORM_SOURCE_URL);
  });
});
