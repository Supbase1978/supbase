import { describe, expect, it } from "vitest";

import {
  cleanModelName,
  detectInflatable,
  extractModelYear,
  extractProduct,
  guessBoardType,
  normalizeBrandName,
  parseAvailability,
  parseDimensionCm,
  parsePriceHuf,
  parsePriceString,
  parseSpecsFromText,
} from "./normalize.ts";

const NOW = new Date("2026-07-28T00:00:00Z");

describe("normalizeBrandName", () => {
  it.each([
    ["red paddle", "Red Paddle Co"],
    ["RED PADDLE CO", "Red Paddle Co"],
    ["Aqua  Marina", "Aqua Marina"],
    ["Ismeretlen Márka", "Ismeretlen Márka"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeBrandName(input)).toBe(expected);
  });

  it("üres/hiányzó márkára null", () => {
    expect(normalizeBrandName("   ")).toBeNull();
    expect(normalizeBrandName(null)).toBeNull();
  });
});

describe("extractModelYear", () => {
  it.each([
    [`Aqua Marina Vapor 10'4" 2024`, 2024],
    ["a 2022-es modell utódja, 2025-ös kiadás", 2025],
    ["320 cm hosszú deszka", null],
    ["2030-as modell", null], // jövőbe legfeljebb egy évet engedünk
    ["1998-as retró", null],
  ])("%s → %s", (text, expected) => {
    expect(extractModelYear(text, NOW)).toBe(expected);
  });
});

describe("cleanModelName", () => {
  it.each([
    [`Aqua Marina Vapor 10'4" felfújható SUP deszka 2024`, "Aqua Marina", "Vapor"],
    [`Red Paddle Co Ride 10'6" 2023-as`, "Red Paddle Co", "Ride"],
    ["Fanatic Ray Air Touring 320 cm", "Fanatic", "Ray Air Touring"],
    ["Gladiator PRO 12'6 | felfújható szett", "Gladiator", "PRO"],
  ])("%s (%s) → %s", (title, brand, expected) => {
    expect(cleanModelName(title, brand)).toBe(expected);
  });

  it("márka nélkül is tisztít", () => {
    expect(cleanModelName(`Vapor 10'4" SUP`)).toBe("Vapor");
  });
});

describe("parseDimensionCm", () => {
  it.each([
    [`10'6"`, 320],
    ["10' 6''", 320],
    ["320 cm", 320],
    ["3,2 m", 320],
    [`32"`, 81.3],
    ["32 coll", 81.3],
    ["150 mm", 15],
    ["nincs benne mérték", null],
  ])("%s → %s cm", (text, expected) => {
    expect(parseDimensionCm(text)).toBe(expected);
  });
});

describe("parseSpecsFromText", () => {
  const HU_SPEC = `
    Hosszúság: 320 cm
    Szélesség: 81 cm
    Vastagság: 15 cm
    Térfogat: 290 l
    Súly: 9,5 kg
    Teherbírás: 140 kg
    Felfújható deszka, dupla rétegű drop-stitch
  `;

  it("kiolvassa a magyar spec-táblázatot", () => {
    expect(parseSpecsFromText(HU_SPEC)).toEqual({
      lengthCm: 320,
      widthCm: 81,
      thicknessCm: 15,
      volumeL: 290,
      weightKg: 9.5,
      maxLoadKg: 140,
      inflatable: true,
    });
  });

  it("a Max weight a TEHERBÍRÁS, nem a deszka súlya", () => {
    const specs = parseSpecsFromText("Max weight: 140 kg");
    expect(specs.maxLoadKg).toBe(140);
    expect(specs.weightKg).toBeNull();
  });

  it("címke nélküli számot NEM olvas ki (inkább hiányozzon, mint tévedjen)", () => {
    const specs = parseSpecsFromText("Nagyszerű deszka, 320 cm, 140 kg, 290 l");
    expect(specs.lengthCm).toBeNull();
    expect(specs.maxLoadKg).toBeNull();
    expect(specs.volumeL).toBeNull();
  });

  it("hiányzó mezők null-ok maradnak", () => {
    expect(parseSpecsFromText("Hosszúság: 320 cm")).toMatchObject({
      lengthCm: 320,
      widthCm: null,
      maxLoadKg: null,
    });
  });
});

describe("detectInflatable", () => {
  it.each([
    ["felfújható SUP", true],
    ["inflatable iSUP board", true],
    ["kemény deszka, epoxy", false],
    ["SUP deszka", null],
  ])("%s → %s", (text, expected) => {
    expect(detectInflatable(text)).toBe(expected);
  });
});

describe("guessBoardType", () => {
  it.each([
    ["Aqua Marina Vapor allround", "allround"],
    ["Ray Air Touring túra deszka", "touring"],
    ["Junior kids SUP touring", "kids"], // specifikus győz az általános felett
    ["Horgász SUP nagy stabilitással", "fishing"],
    ["Race verseny deszka", "race"],
    ["jóga deszka", "yoga"],
    ["folyó / river board", "river"],
    ["Semmilyen kulcsszó", null],
  ])("%s → %s", (text, expected) => {
    expect(guessBoardType(text)).toBe(expected);
  });
});

describe("parsePriceString", () => {
  it.each([
    ["189000", 189000],
    ["429.000 Ft", 429000],
    ["429 000", 429000],
    ["429,000", 429000],
    ["189000.50", 189000.5],
    ["", null],
  ])("%s → %s", (raw, expected) => {
    expect(parsePriceString(raw)).toBe(expected);
  });
});

describe("parsePriceHuf", () => {
  it("egy ajánlatból kiolvassa a forint-árat", () => {
    expect(parsePriceHuf({ price: "189000", priceCurrency: "HUF" })).toBe(189000);
  });

  it("több ajánlatból a legolcsóbbat", () => {
    expect(
      parsePriceHuf([
        { price: 219000, priceCurrency: "HUF" },
        { price: "189 000", priceCurrency: "HUF" },
      ]),
    ).toBe(189000);
  });

  it("AggregateOffer lowPrice-t is elfogad", () => {
    expect(
      parsePriceHuf({ "@type": "AggregateOffer", lowPrice: "189000", priceCurrency: "HUF" }),
    ).toBe(189000);
  });

  it("explicit NEM-forint pénznemet elutasít (nem váltunk át)", () => {
    expect(parsePriceHuf({ price: "499", priceCurrency: "EUR" })).toBeNull();
  });

  it("hiányzó ár vagy offers → null", () => {
    expect(parsePriceHuf(undefined)).toBeNull();
    expect(parsePriceHuf({ priceCurrency: "HUF" })).toBeNull();
  });
});

describe("parseAvailability", () => {
  it.each([
    ["https://schema.org/InStock", true],
    ["http://schema.org/OutOfStock", false],
    ["PreOrder", true],
    ["Ismeretlen", null],
  ])("%s → %s", (availability, expected) => {
    expect(parseAvailability({ availability })).toBe(expected);
  });

  it("egyetlen készleten lévő ajánlat elég", () => {
    expect(
      parseAvailability([
        { availability: "https://schema.org/OutOfStock" },
        { availability: "https://schema.org/InStock" },
      ]),
    ).toBe(true);
  });
});

describe("extractProduct", () => {
  const NODE = {
    "@type": "Product",
    name: `Aqua Marina Vapor 10'4" felfújható SUP 2024`,
    brand: { "@type": "Brand", name: "aqua marina" },
    description: "Allround deszka kezdőknek.",
    image: ["https://bolt.hu/kep.jpg"],
    offers: {
      "@type": "Offer",
      price: "189000",
      priceCurrency: "HUF",
      availability: "https://schema.org/InStock",
    },
  };

  it("teljes jelöltet állít elő a JSON-LD-ből és az oldalszövegből", () => {
    const product = extractProduct(NODE, "https://bolt.hu/termek/vapor", "Teherbírás: 140 kg");
    expect(product).toMatchObject({
      sourceUrl: "https://bolt.hu/termek/vapor",
      brandName: "Aqua Marina",
      modelName: "Vapor",
      modelYear: 2024,
      priceHuf: 189000,
      inStock: true,
      boardType: "allround",
      imageUrl: "https://bolt.hu/kep.jpg",
    });
    expect(product?.specs.maxLoadKg).toBe(140);
  });

  it("a címbeli méret-jelölés adja a hosszt, ha a spec-táblázat hallgat", () => {
    expect(extractProduct(NODE, "https://bolt.hu/x")?.specs.lengthCm).toBe(315.0);
  });

  it("a spec-táblázat ERŐSEBB a címbeli méretnél", () => {
    const product = extractProduct(NODE, "https://bolt.hu/x", "Hosszúság: 320 cm");
    expect(product?.specs.lengthCm).toBe(320);
  });

  it("név nélküli node → null (nem gyártunk névtelen jelöltet)", () => {
    expect(extractProduct({ "@type": "Product" }, "https://bolt.hu/x")).toBeNull();
  });
});
