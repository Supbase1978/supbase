import { describe, expect, it } from "vitest";

import { buildBoardInsert } from "./candidates.server";
import type { ExtractedBoardData } from "../types";

const EXTRACTED: ExtractedBoardData = {
  sourceUrl: "https://bolt.hu/termek/vapor",
  brandName: "Aqua Marina",
  modelName: "Vapor",
  rawTitle: `Aqua Marina Vapor 10'4" 2024`,
  modelYear: 2024,
  priceHuf: 189000,
  inStock: true,
  imageUrl: "https://bolt.hu/kep.jpg",
  boardType: "allround",
  specs: {
    lengthCm: 315.0,
    widthCm: 81.3,
    thicknessCm: 15,
    volumeL: 290,
    weightKg: 9.5,
    maxLoadKg: 140,
    inflatable: true,
  },
};

const OPTIONS = {
  brandId: "brand-1",
  boardType: "allround" as const,
  slug: "aqua-marina-vapor",
  seenAt: "2026-07-28T10:00:00.000Z",
};

describe("buildBoardInsert", () => {
  it("a jelöltből teljes boards-payloadot épít", () => {
    expect(buildBoardInsert(EXTRACTED, OPTIONS)).toEqual({
      brand_id: "brand-1",
      model_name: "Vapor",
      model_year: 2024,
      slug: { hu: "aqua-marina-vapor", en: "aqua-marina-vapor" },
      kind: "board",
      board_type: "allround",
      length_cm: 315,
      width_cm: 81, // a séma int oszlopai kerekítve kapják a cm-t
      thickness_cm: 15,
      volume_l: 290,
      weight_kg: 9.5,
      max_load_kg: 140,
      inflatable: true,
      image_url: "https://bolt.hu/kep.jpg",
      availability_hu: true,
      status: "active",
      first_seen_at: OPTIONS.seenAt,
      last_seen_at: OPTIONS.seenAt,
    });
  });

  it("a jóváhagyott jelöltből DESZKA lesz, kiírt kind-dal (nem kiegészítő)", () => {
    // A Deszkaválasztó-invariáns írási oldala: a moderációs jóváhagyás soha nem
    // csempészhet `accessory` sort a deszka-katalógusba.
    const insert = buildBoardInsert(EXTRACTED, OPTIONS);
    expect(insert.kind).toBe("board");
    expect(insert.accessory_type).toBeUndefined();
  });

  it("a moderátor típusa GYŐZ a figyelő tippje felett", () => {
    const insert = buildBoardInsert(EXTRACTED, { ...OPTIONS, boardType: "touring" });
    expect(insert.board_type).toBe("touring");
  });

  it("a hiányzó specek null-ként mennek be (nem találgatunk)", () => {
    const insert = buildBoardInsert(
      {
        ...EXTRACTED,
        specs: {
          lengthCm: null,
          widthCm: null,
          thicknessCm: null,
          volumeL: null,
          weightKg: null,
          maxLoadKg: null,
          inflatable: null,
        },
      },
      OPTIONS,
    );
    expect(insert).toMatchObject({
      length_cm: null,
      volume_l: null,
      max_load_kg: null,
      inflatable: true, // a felfújható a piac alapértelmezése — a moderátor javítja
    });
  });

  it("ismeretlen készlet-állapotnál NEM állítja elérhetőre", () => {
    const insert = buildBoardInsert({ ...EXTRACTED, inStock: null }, OPTIONS);
    expect(insert.availability_hu).toBe(false);
  });

  it("üres modellnév esetén a nyers címet használja (ne legyen névtelen sor)", () => {
    const insert = buildBoardInsert({ ...EXTRACTED, modelName: "" }, OPTIONS);
    expect(insert.model_name).toBe(EXTRACTED.rawTitle);
  });
});
