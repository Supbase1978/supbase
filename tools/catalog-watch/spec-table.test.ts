import { describe, expect, it } from "vitest";

import {
  mergeSpecTables,
  normalizeSizeKey,
  parseRiderWeightKg,
  parseSpecTable,
  sizeKeyFromHeader,
} from "./spec-table.ts";

/**
 * MINDEN minta ÉLESBEN LEKÉRT star-board.com tábla (2026-08-19), Playwrighttal
 * renderelve — a formátum-szabálytalanságok (szóköz nélküli modellnév, göndör
 * idézőjel, kivitelenkénti felsorolás) mind valódiak.
 */
const ICON_TABLE = [
  ["Model", `14'0" x 32" iCON`, `12'0" x 33" iCON`, `10'8" x 33" iCON`],
  ["Rider Weight", "70-135 kg", "55-120 kg", "45-120 kg"],
  ["Length", `14'0" / 426.7 cm`, `12'0" / 365.8 cm`, `10'8" / 325.1 cm`],
  ["Width", `32" / 81.3 cm`, `33" / 83.8 cm`, `33" / 83.8 cm`],
  ["Thickness", `4.75" / 12 cm`, `4.75" / 12 cm`, `4.75" / 12 cm`],
  ["Tail Width", `17.9" / 45.5 cm`, `18.1" / 46 cm`, `20.1" / 51 cm`],
  ["Volume", "328L", "299L", "272L"],
  ["Fin Set Up", "3 pcs. Drop US Box (Roll)", "3 pcs. Drop US Box (Roll)", "3 pcs. Drop US Box (Roll)"],
  ["Weight", "12.10 kg (Est.)", "11.10 kg (Est.)", "9.30 kg (Est.)"],
  ["Construction", "Deluxe", "Deluxe", "Deluxe"],
];

describe("sizeKeyFromHeader", () => {
  it("a fejlécből csak a dimenziót veszi, a modellnevet eldobja", () => {
    expect(sizeKeyFromHeader(`14'0" x 32" iCON`)).toBe(normalizeSizeKey(`14'0" x 32"`));
  });

  it("kezeli a szóköz NÉLKÜL tapadó modellnevet (Whopper élesben)", () => {
    expect(sizeKeyFromHeader(`10'0" x 34"WHOPPER`)).toBe(normalizeSizeKey(`10'0" x 34"`));
  });

  it("kezeli a göndör idézőjeleket és a hosszú modellnevet", () => {
    expect(sizeKeyFromHeader(`12’6” x 28” TOURING WITH PADDLE`)).toBe(
      normalizeSizeKey(`12'6" x 28"`),
    );
  });

  it("nem méret fejlécre null", () => {
    expect(sizeKeyFromHeader("Model")).toBeNull();
    expect(sizeKeyFromHeader("Technology")).toBeNull();
  });

  it("a Shopify variáns-címkéjével EGYEZŐ kulcsot ad (ez köti össze a kettőt)", () => {
    // shopify.ts a `12'0" X 34"` alakot állítja elő (nagy X, szóközökkel).
    expect(sizeKeyFromHeader(`12'0" x 34" GO`)).toBe(normalizeSizeKey(`12'0" X 34"`));
  });
});

describe("parseRiderWeightKg — a teherbírás közelítése", () => {
  it("tartományból a FELSŐ határt veszi", () => {
    expect(parseRiderWeightKg("70-135 kg")).toBe(135);
    expect(parseRiderWeightKg("60 - 120 kg")).toBe(120);
    expect(parseRiderWeightKg("45-85 kg")).toBe(85);
  });

  it("a felső korlátos alakot is kezeli", () => {
    expect(parseRiderWeightKg("Up to 130 kg")).toBe(130);
    expect(parseRiderWeightKg("Under 90 kg")).toBe(90);
  });

  it("emberi testsúly-tartományon kívüli értéket nem fogad el", () => {
    expect(parseRiderWeightKg("900 kg")).toBeNull();
    expect(parseRiderWeightKg("5 kg")).toBeNull();
  });

  it("szám nélküli cellára null", () => {
    expect(parseRiderWeightKg("TBC")).toBeNull();
    expect(parseRiderWeightKg("")).toBeNull();
  });
});

describe("parseSpecTable", () => {
  it("méretenként kiolvassa a HIÁNYZÓ mezőket a valódi iCON-tábláról", () => {
    const specs = parseSpecTable(ICON_TABLE);
    expect(specs.size).toBe(3);

    const long = specs.get(normalizeSizeKey(`14'0" x 32"`));
    expect(long).toMatchObject({
      lengthCm: 426.7,
      widthCm: 81.3,
      thicknessCm: 12,
      volumeL: 328,
      weightKg: 12.1,
      maxLoadKg: 135, // a 70-135 kg felső határa
    });

    const small = specs.get(normalizeSizeKey(`10'8" x 33"`));
    expect(small).toMatchObject({ thicknessCm: 12, weightKg: 9.3, maxLoadKg: 120, volumeL: 272 });
  });

  it("a `Tail Width` sort NEM veszi szélességnek", () => {
    const specs = parseSpecTable(ICON_TABLE);
    // Ha a Tail Width felülírná, 45.5 lenne 81.3 helyett.
    expect(specs.get(normalizeSizeKey(`14'0" x 32"`))?.widthCm).toBe(81.3);
  });

  it("a `Rider Weight` sort NEM veszi a deszka súlyának", () => {
    const specs = parseSpecTable(ICON_TABLE);
    expect(specs.get(normalizeSizeKey(`14'0" x 32"`))?.weightKg).toBe(12.1);
  });

  it("a KIVITELENKÉNT felsoroló cellából nem tippel (inkább hiányozzon)", () => {
    // Élesben mért Whopper-cella: több érték egy cellában.
    const whopper = [
      ["Model", `10'0" x 34"WHOPPER`],
      ["Volume", "Blue Carbon, Starlite: 174 LLite Tech Wave, Rhino: 168 LASAP: 183 L"],
      ["Weight", "Blue Carbon: 10.4 kg (Est.)Starlite: 11.2 kg (Est.)Lite Tech: 11.0 kg (Est.)"],
      ["Thickness", `4.3" / 10.9 cm`],
    ];
    const specs = parseSpecTable(whopper);
    const entry = specs.get(normalizeSizeKey(`10'0" x 34"`));
    expect(entry?.volumeL).toBeNull();
    expect(entry?.weightKg).toBeNull();
    // A félreérthetetlen mező viszont megvan.
    expect(entry?.thicknessCm).toBe(10.9);
  });

  it("a `Weight (Tolerance +/- 5%)` címkét is felismeri", () => {
    const table = [
      ["Model", `11'2" x 38" VISION`],
      ["Weight (Tolerance +/- 5%)", "9.70 kg"],
      ["Rider Weight", "Up to 130 kg"],
    ];
    const specs = parseSpecTable(table);
    const entry = specs.get(normalizeSizeKey(`11'2" x 38"`));
    expect(entry?.weightKg).toBe(9.7);
    expect(entry?.maxLoadKg).toBe(130);
  });

  it("a hüvelyk-értékből NEM számol cm-t (csak a gyártó kiírt cm-jét fogadja)", () => {
    const table = [
      ["Model", `10'0" x 34" X`],
      ["Thickness", `4.75"`], // nincs `/ … cm`
    ];
    expect(parseSpecTable(table).get(normalizeSizeKey(`10'0" x 34"`))?.thicknessCm).toBeNull();
  });

  it("nem spec-tábla (tartozéklista) esetén üres térkép", () => {
    const accessories = [
      ["iCON", "Technology", "Deluxe"],
      ["", "Fin", `Dol-fin Net Positive`],
      ["", "Repair Kit", "1 pc"],
    ];
    expect(parseSpecTable(accessories).size).toBe(0);
  });

  it("üres vagy egyoszlopos táblára üres térkép", () => {
    expect(parseSpecTable([]).size).toBe(0);
    expect(parseSpecTable([["Model"]]).size).toBe(0);
  });
});

describe("mergeSpecTables", () => {
  it("több táblából az első nem-null értéket tartja meg", () => {
    const first = [
      ["Model", `14'0" x 32" iCON`],
      ["Thickness", `4.75" / 12 cm`],
    ];
    const second = [
      ["Model", `14'0" x 32" iCON`],
      ["Thickness", `9" / 99 cm`], // későbbi tábla NEM írja felül
      ["Rider Weight", "70-135 kg"], // de a hiányzót kiegészíti
    ];
    const merged = mergeSpecTables([first, second]);
    const entry = merged.get(normalizeSizeKey(`14'0" x 32"`));
    expect(entry?.thicknessCm).toBe(12);
    expect(entry?.maxLoadKg).toBe(135);
  });

  it("a nem-spec táblákat egyszerűen kihagyja", () => {
    const merged = mergeSpecTables([[["iCON", "Technology"]], ICON_TABLE]);
    expect(merged.size).toBe(3);
  });
});

/**
 * ÉLESBEN MÉRT HIBA (2026-08-19, star-board.com Roamer): a „Gross Load Weight"
 * sor a „weight" részstring miatt a deszka SÚLYÁBA került — 130 kg-os deszkát
 * írt volna be, a valódi 13.93 kg helyett, és a teherbírás üresen maradt.
 */
const ROAMER_TABLE = [
  ["Model", `14'0" x 28.5" ROAMER`],
  ["Gross Load Weight", "130 kg"],
  ["Length", `14'0" / 427.8 cm`],
  ["Width", `28.5" / 72.5 cm`],
  ["Thickness", `11.6" / 29.4 cm`],
  ["Tail Width", `16.5" / 42 cm`],
  ["Volume", "324 L"],
  ["Weight", "Xtec Carbon D2: 13.93 kg"],
];

describe("parseSpecTable — teherbírás-címkék (élesben mért hibák)", () => {
  it("a `Gross Load Weight` a TEHERBÍRÁS, nem a deszka súlya", () => {
    const entry = parseSpecTable(ROAMER_TABLE).get(normalizeSizeKey(`14'0" x 28.5"`));
    expect(entry?.maxLoadKg).toBe(130);
    // A deszka saját súlya a külön „Weight" sorból jön.
    expect(entry?.weightKg).toBe(13.93);
  });

  it("a gyártó saját, önmagával konzisztens vastagságát átveszi", () => {
    // 11.6" = 29.4 cm — szokatlan, de a gyártó ezt közli, és a két egység egyezik.
    const entry = parseSpecTable(ROAMER_TABLE).get(normalizeSizeKey(`14'0" x 28.5"`));
    expect(entry?.thicknessCm).toBe(29.4);
  });

  it("az Aqua Marina `MAX. PAYLOAD` / `NET WEIGHT` párost helyesen osztja szét", () => {
    // A gyártói adatlap alakja (aquamarina.com, BLAZE 10'4").
    const blaze = [
      ["Model", `10'4" x 31" BLAZE`],
      ["NET WEIGHT", "20.5 lbs / 9.3 kg"],
      ["LENGTH", `10'4" / 315 cm`],
      ["WIDTH", `31" / 79 cm`],
      ["THICKNESS", `6" / 15 cm`],
      ["VOLUME", "315 L"],
      ["MAX. PAYLOAD", "308 lbs / 140 kg"],
    ];
    const entry = parseSpecTable(blaze).get(normalizeSizeKey(`10'4" x 31"`));
    expect(entry?.maxLoadKg).toBe(140);
    expect(entry?.thicknessCm).toBe(15);
    expect(entry?.volumeL).toBe(315);
  });
});
