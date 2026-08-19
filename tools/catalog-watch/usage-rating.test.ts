import { describe, expect, it } from "vitest";

import { boardTypeFromUsage, parseUsageRatings } from "./usage-rating.ts";

/**
 * ÉLESBEN MÉRT alakok (aquamarina.com, 2026-08-19). A gyártó minden deszkát
 * pontoz négy használati mód szerint; a horgony az `aria-valuetext` attribútum,
 * ami kifejezetten képernyőolvasóknak szánt, ember által olvasható összefoglaló
 * — stabilabb, mint a vizuális markup.
 */
function bars(pairs: [string, number][]): string {
  return pairs
    .map(([label, pct]) => `<div role="progressbar" aria-valuetext="${pct}% (${label})"></div>`)
    .join("\n");
}

describe("parseUsageRatings", () => {
  it("kiolvassa a címkét és a százalékot", () => {
    const html = bars([
      ["ALL-AROUND/ENTRY", 100],
      ["GUIDE/EXPLORE", 60],
    ]);
    expect(parseUsageRatings(html)).toEqual([
      { label: "ALL-AROUND/ENTRY", percent: 100, type: "allround" },
      { label: "GUIDE/EXPLORE", percent: 60, type: "touring" },
    ]);
  });

  it("a szóközös írásmódot is kezeli (a gyártó vegyesen használja)", () => {
    // Élesben: a Blaze „GUIDE/EXPLORE", a Coral „GLIDE / EXPLORE".
    expect(parseUsageRatings(bars([["GLIDE / EXPLORE", 70]]))[0]?.type).toBe("touring");
    expect(parseUsageRatings(bars([["ALL-AROUND / ENTRY", 100]]))[0]?.type).toBe("allround");
  });
});

describe("boardTypeFromUsage", () => {
  it("a legerősebb használat adja a kategóriát", () => {
    const blaze = bars([
      ["ALL-AROUND/ENTRY", 100],
      ["GUIDE/EXPLORE", 60],
      ["SURF/WAVE", 80],
      ["RACE/TRAINING", 40],
    ]);
    expect(boardTypeFromUsage(blaze)).toBe("allround");
  });

  it("a versenydeszkát race-nek sorolja", () => {
    expect(
      boardTypeFromUsage(bars([["ALL-AROUND/ENTRY", 40], ["RACE/TRAINING", 100]])),
    ).toBe("race");
  });

  it("ha a SZÖRF vezet, `surf`-öt ad — azt a katalógus nem gyűjti", () => {
    expect(
      boardTypeFromUsage(bars([["ALL-AROUND/ENTRY", 50], ["SURF/WAVE", 100]])),
    ).toBe("surf");
  });

  it("DÖNTETLENNÉL nem tippel (a moderátor dönt)", () => {
    expect(
      boardTypeFromUsage(bars([["ALL-AROUND/ENTRY", 100], ["RACE/TRAINING", 100]])),
    ).toBeNull();
  });

  it("MÁS értékelés-készletet figyelmen kívül hagy", () => {
    // A NUTS oldala TRACKING/MANEUVERABILITY/STABILITY/SPEED sávokat mutat —
    // ezek nem használati módok, ezért nem adnak kategóriát.
    const nuts = bars([
      ["TRACKING", 80],
      ["MANEUVERABILITY", 80],
      ["STABILITY", 90],
      ["SPEED", 70],
    ]);
    expect(boardTypeFromUsage(nuts)).toBeNull();
  });

  it("értékelés nélküli oldalra null", () => {
    expect(boardTypeFromUsage("<html><body>semmi</body></html>")).toBeNull();
  });
});
