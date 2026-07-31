import { describe, expect, it } from "vitest";

import {
  classifyProduct,
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
    // Élesben mért: a bolt „Gladiator SUP"-ot ír oda, ahol a katalógus „Gladiator".
    ["Gladiator SUP", "Gladiator"],
    // Élesben mért (2026-07-31): a bluefinsupboards.eu JSON-LD-je sok terméken
    // "Bluefin-testing"-et ad (a bolt oldalán maradt teszt-adat).
    ["Bluefin-testing", "Bluefin"],
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

  it("a Paddle Length NEM írja felül a deszka hosszát (élesben mért ütközés)", () => {
    // bluefinsupboards.eu deszka+evező csomag oldala: az evező saját "Paddle
    // Length" címkéje a deszka "length" címkéjével ütközne szűrő nélkül.
    const specs = parseSpecsFromText(
      "Paddle Length: Max height: 210cm & 83 inches\nDimensions: 325 x 82 x16cm & 128 x 32 x 6 inches",
    );
    expect(specs.lengthCm).toBe(325);
  });

  it("a Max User Weight a teherbírás (nem csak a csupasz Max weight)", () => {
    const specs = parseSpecsFromText("Max User Weight: 150kg");
    expect(specs.maxLoadKg).toBe(150);
  });

  it("összevont 'Dimensions: L x W x Hcm' sorból mindhárom méretet kiolvassa", () => {
    const specs = parseSpecsFromText("Dimensions: 325 x 82 x16cm & 128 x 32 x 6 inches");
    expect(specs.lengthCm).toBe(325);
    expect(specs.widthCm).toBe(82);
    expect(specs.thicknessCm).toBe(16);
  });

  it("a Bag Dimensions NEM keveredik a deszka méretével", () => {
    const specs = parseSpecsFromText(
      "Board Weight: 9.1kg\nBag Dimensions: 90 x 40 x20cm",
    );
    expect(specs.lengthCm).toBeNull();
    expect(specs.widthCm).toBeNull();
    expect(specs.thicknessCm).toBeNull();
  });

  it("a külön címkéjű méret ELSŐBBSÉGET élvez az összevont sorral szemben", () => {
    const specs = parseSpecsFromText(
      "Hosszúság: 320 cm\nDimensions: 325 x 82 x 16cm",
    );
    expect(specs.lengthCm).toBe(320);
    // A width/thickness külön címke híján az összevontból pótlódik.
    expect(specs.widthCm).toBe(82);
    expect(specs.thicknessCm).toBe(16);
  });

  it("magyar 'Mérete (L x W x H cm)' címke is felismert (nem csak 'Méretek')", () => {
    // Élesben mért: aquamarinahungary.com a "Mérete" (nem "Méretek") szót írja.
    const specs = parseSpecsFromText("Mérete (366 x 84 x 15 cm)\nNettó súly 10.5kg");
    expect(specs.lengthCm).toBe(366);
    expect(specs.widthCm).toBe(84);
    expect(specs.thicknessCm).toBe(15);
    expect(specs.weightKg).toBe(10.5);
  });

  it("összevont 'Dimensions: L x W x H Inches' (csak hüvelyk, cm nélkül) is felismeri", () => {
    // Élesben mért eset: bluefinsupboards.eu "Lite" termékvonala csak
    // hüvelyket ad, cm-et nem.
    const specs = parseSpecsFromText("Dimensions: 120 x 34 x 6 Inches");
    expect(specs.lengthCm).toBeCloseTo(304.8, 1);
    expect(specs.widthCm).toBeCloseTo(86.4, 1);
    expect(specs.thicknessCm).toBeCloseTo(15.2, 1);
  });

  it("valós Bluefin-oldal szövege — mindhárom méret + súly + teherbírás helyesen jön ki", () => {
    // Élesben letöltött oldal (2026-07-31) tömörített szövege, a releváns rész.
    const text =
      "Dimensions: 325 x 82 x16cm & 128 x 32 x 6 inches\n" +
      "Max User Weight: 150kg\n" +
      "Board Weight: 9.1kg\n" +
      "Package Weight: 14kg\n" +
      "Paddle Length: Max height: 210cm & 83 inches";
    expect(parseSpecsFromText(text)).toMatchObject({
      lengthCm: 325,
      widthCm: 82,
      thicknessCm: 16,
      weightKg: 9.1,
      maxLoadKg: 150,
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

  it("a WooCommerce/Rank Math priceSpecification-beágyazásból is kiolvassa", () => {
    // Élesben mért alak: az ár nem az Offeren, hanem egy PriceSpecification-ben.
    expect(
      parsePriceHuf([
        {
          "@type": "Offer",
          availability: "Nincs raktáron",
          priceSpecification: {
            "@type": "PriceSpecification",
            price: "224000",
            priceCurrency: "HUF",
          },
        },
      ]),
    ).toBe(224000);
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
    // Magyar szabad szöveg (élesben mért). A tagadást előbb kell vizsgálni:
    // a „Nincs raktáron" tartalmazza a „raktáron"-t is.
    ["Nincs raktáron", false],
    ["Raktáron", true],
    ["Elfogyott", false],
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

describe("classifyProduct", () => {
  const NO_SPECS = {
    lengthCm: null,
    widthCm: null,
    thicknessCm: null,
    volumeL: null,
    weightKg: null,
    maxLoadKg: null,
    inflatable: null,
  };

  it.each([
    [`Aqua Marina Vapor 10'4" felfújható SUP deszka`, "allround" as const, { kind: "board" }],
    ["Gladiator Origin paddleboard", null, { kind: "board" }],
    ["Jobe Aero SUP Yoga 10.6", "yoga" as const, { kind: "board" }],
    // Élesben mért eset: egy SUP-bolt sitemapjében napszemüveg is van — egyik
    // gear-kategóriának sem felel meg, tehát `ignore` (nem `accessory`).
    ["Jobe DIM napszemüveg Tortoise", null, { kind: "ignore" }],
    // A 3 KÖVETETT kategória (terv 3. szakasz, mennyiségi korlát) jelöltet kap.
    ["Karbon SUP evező állítható", null, { kind: "accessory", accessoryType: "evezo" }],
    ["Kétkamrás SUP pumpa", null, { kind: "accessory", accessoryType: "pumpa" }],
    ["ION mentőmellény L-es méret", null, { kind: "accessory", accessoryType: "mentomelleny" }],
    // A többi felismert kategória (nem követett) `ignore` marad.
    ["Vízhatlan táska 20 l", null, { kind: "ignore" }],
    ["SUP póráz derékon hordható", null, { kind: "ignore" }],
    ["Valami ismeretlen termék", null, { kind: "ignore" }],
  ])("%s → %o", (rawTitle, boardType, expected) => {
    expect(
      classifyProduct({ rawTitle, modelName: rawTitle, boardType, specs: NO_SPECS }),
    ).toEqual(expected);
  });

  it("a MÉRT deszka-spec erősebb minden kulcsszónál", () => {
    expect(
      classifyProduct({
        rawTitle: "Névtelen termék",
        modelName: "Névtelen",
        boardType: null,
        specs: { ...NO_SPECS, lengthCm: 320, maxLoadKg: 140 },
      }),
    ).toEqual({ kind: "board" });
  });

  it("a deszka-tartományon kívüli hossz önmagában nem elég, de a KÖVETETT kulcsszó felülír", () => {
    expect(
      classifyProduct({
        rawTitle: "Evezőlapát",
        modelName: "Evezőlapát",
        boardType: null,
        specs: { ...NO_SPECS, lengthCm: 180, volumeL: 2 },
      }),
    ).toEqual({ kind: "accessory", accessoryType: "evezo" });
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
