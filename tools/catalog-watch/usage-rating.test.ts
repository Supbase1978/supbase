import { describe, expect, it } from "vitest";

import { boardTypeFromDescription, boardTypeFromUsage, parseUsageRatings } from "./usage-rating.ts";

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

/**
 * A gyártó SAJÁT LEÍRÁSA (F2.1-utó-23). A NUTS-nál a használat-sávok más
 * készletet mutatnak (TRACKING/STABILITY), a próza viszont kimondja:
 * „Our NUTS board is the perfect all-around board for first-time paddlers".
 */
describe("boardTypeFromDescription", () => {
  it("a NUTS valódi leírásából allroundot ad", () => {
    const nuts =
      "Our NUTS board is the perfect all-around board for first-time paddlers who want " +
      "less fuss and more enjoyable water fun anywhere with their family, friends or pets.";
    expect(boardTypeFromDescription(nuts)).toBe("allround");
  });

  it("a `board` szó KÖTELEZŐ — a puszta kategória-menü nem elég", () => {
    // A navigáció minden oldalon felsorolja a kategóriákat; e nélkül a
    // szigorítás nélkül minden oldal hamis találatot adna.
    expect(boardTypeFromDescription("ALL-AROUND / ENTRY GLIDE / EXPLORE RACE / TRAINING")).toBeNull();
  });

  it("túra- és versenydeszkát is felismer", () => {
    expect(boardTypeFromDescription("A fast touring board for long distances.")).toBe("touring");
    expect(boardTypeFromDescription("Our race board wins championships.")).toBe("race");
  });

  it("TÖBB, eltérő kategória említésénél nem tippel", () => {
    expect(
      boardTypeFromDescription("Both an all-around board and a race board in one."),
    ).toBeNull();
  });

  it("kategória-kifejezés nélküli leírásra null", () => {
    // A Revolution valódi leírása: körülír, de nem mond kategóriát.
    const revolution =
      "Designed to be stable enough for a first-time experience but with a shape to " +
      "entertain the expert paddler with performance.";
    expect(boardTypeFromDescription(revolution)).toBeNull();
  });
});
