import { describe, expect, it } from "vitest";

import { familyKey, imagePathIdentity, planImagePruning } from "./image-sharing.ts";
import type { BoardImages } from "./image-sharing.ts";

function board(
  id: string,
  modelName: string,
  gallery: string[],
  imageUrl: string | null = null,
): BoardImages {
  return { id, brandName: "Starboard", modelName, imageUrl, gallery };
}

describe("imagePathIdentity", () => {
  it("a lekérdező részt és a méret-könyvtárat elhagyja", () => {
    expect(imagePathIdentity("https://x.com/a/3469216.jpg?x-oss=resize,h_200")).toBe(
      "https://x.com/a/3469216.jpg",
    );
    expect(imagePathIdentity("https://x.com/img/AMB1/80x52/AMB1.jpg")).toBe(
      "https://x.com/img/AMB1/AMB1.jpg",
    );
  });
});

describe("familyKey", () => {
  it("a modellnév ELSŐ szava a család", () => {
    expect(familyKey("BOTE", "LowRider Aero Tandem")).toBe(familyKey("BOTE", "LowRider Aero"));
    expect(familyKey("BOTE", "EasyRider Aero")).not.toBe(familyKey("BOTE", "LowRider Aero"));
  });

  it("a márka is része — két gyártó azonos modellneve nem egy család", () => {
    expect(familyKey("Zray", "Fury")).not.toBe(familyKey("Jobe", "Fury"));
  });
});

describe("planImagePruning", () => {
  /**
   * A CSALÁDON BELÜLI megosztás MARAD: a Starboard kivitelenként fotóz, nem
   * méretenként — a 11'0" és a 9'0" Blue Carbon ugyanazt a gyártói képet
   * viseli, és ilyen fotó méretenként nem is létezik.
   */
  it("a családon belüli közös képhez nem nyúl", () => {
    const shared = "https://x.com/whopper-blue-carbon.jpg";
    const actions = planImagePruning([
      board("a", `Whopper 11'0" X 36" Blue Carbon`, [shared]),
      board("b", `Whopper 9'0" X 33" Blue Carbon`, [shared]),
    ]);
    expect(actions).toEqual([]);
  });

  it("a CSALÁDHATÁRT átlépő közös képet kivágja mindkét oldalról", () => {
    // A fájlnév EGYIK családot sem nevezi meg (kamera-kód), ezért nincs kihez
    // kötni — mindkettőről lekerül.
    const shared = "https://x.com/DSC09080-medium.jpg";
    const actions = planImagePruning([
      board("a", `Sprint 14'0" X 25.5" Deluxe`, [shared, "https://x.com/sprint.jpg"]),
      board("b", `All Star 14'0" X 24.5" Deluxe`, [shared]),
    ]);
    expect(actions).toHaveLength(2);
    expect(actions[0]?.keep).toEqual(["https://x.com/sprint.jpg"]);
    expect(actions[0]?.removed[0]?.sharedWith).toEqual([`All Star 14'0" X 24.5" Deluxe`]);
    expect(actions[1]?.keep).toEqual([]);
  });

  /**
   * A BORÍTÓ nem esik ki, de SZÁMÍT: ha egy másik család BORÍTÓJA ugyanaz a
   * kép, a galéria-példány akkor is megosztott.
   */
  it("a másik család BORÍTÓJÁVAL való ütközést is látja", () => {
    const shared = "https://x.com/leash.jpg";
    const actions = planImagePruning([
      board("a", "Versa 2.0", [shared]),
      board("b", "Sportsman", [], shared),
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.boardId).toBe("a");
    expect(actions[0]?.keep).toEqual([]);
  });

  it("a fájlnév által MEGNEVEZETT családnál marad a kép", () => {
    const shared = "https://x.com/Starboard-SUP-Inflatable-All-star-3.jpg";
    const actions = planImagePruning([
      board("a", `Sprint 14'0" X 25.5" Deluxe`, [shared]),
      board("b", `All Star 14'0" X 24.5" Deluxe`, [shared]),
    ]);
    // Csak a Sprintről esik le; az All Star megtartja a SAJÁT fotóját.
    expect(actions).toHaveLength(1);
    expect(actions[0]?.modelName).toBe(`Sprint 14'0" X 25.5" Deluxe`);
  });

  it("a méret-változatokat ugyanannak a képnek látja", () => {
    const actions = planImagePruning([
      board("a", "Versa 2.0", ["https://x.com/img/A/fin.jpg"]),
      board("b", "Sportsman", ["https://x.com/img/A/80x52/fin.jpg"]),
    ]);
    expect(actions).toHaveLength(2);
  });
});
