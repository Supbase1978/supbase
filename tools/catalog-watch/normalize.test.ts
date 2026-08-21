import { describe, expect, it } from "vitest";

import { EMPTY_SPECS } from "./types.ts";

import {
  classifyProduct,
  cleanModelName,
  detectInflatable,
  extractModelYear,
  extractProduct,
  extractProductFromPage,
  extractProductsFromPage,
  boardTypeFromProse,
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
    // Élesben mért hiba (2026-08-13, Indiana Paddle & Surf pending jelöltek):
    // dupla-aposztróffal írt hüvelyk-jel NEM láb-jel — a "32''" korábban
    // 32 lábként (975,4cm) parse-olódott 81,3cm helyett.
    ["32''", 81.3],
    [`10'6''`, 320],
    // TARTOMÁNY NEM MÉRET. Élesben (aquamarinahungary.com): a termékoldal
    // alján az ÁLLÍTHATÓ EVEZŐ adata áll (`hossza: 165-210cm`), amiből 210 cm
    // „deszkahossz" lett egy 366 cm-es deszkára. Egyetlen deszka hossza sem
    // tartomány — inkább maradjon üres, mint hogy hamis legyen.
    ["165-210cm", null],
    ["165 – 210 cm", null],
    ["30-34 inch", null],
  ])("%s → %s cm", (text, expected) => {
    expect(parseDimensionCm(text)).toBe(expected);
  });

  it("a dupla-aposztróf hüvelyk-hiba miatt korábban elveszett, KORÁBBAN álló cm-érték most helyesen elsőbbséget élvez", () => {
    // Élesben mért teljes szövegkörnyezet (indiana-paddlesurf.com): a "width"
    // címke UTÁNI ablak MINDKÉT alakot tartalmazza — a helyes "81,3 cm" előbb
    // áll, a hibásan lábként olvasott "32''" később. A régi kód a "32''"-t
    // találta meg előbb (bárhol a szövegben feet-mintát keresett), a 32
    // lábként (975,4cm) parse-olva. A javítás után a "32''" NEM illeszkedik
    // láb-mintaként, így a cm-ellenőrzés a korábbi, helyes értéket adja.
    expect(parseDimensionCm(" CM: 81,3 cm Width Foot/Inch: 32''")).toBe(81.3);
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

  it("ragozott alak (leíró mondatban) NEM keveredik a tiszta táblázatos értékkel", () => {
    // Élesben mért hiba (2026-08-13, sup-deszka.hu "MONSTER 12'0""): a
    // leírás "366 cm hosszúságával, 84 cm szélességével és 15 cm
    // vastagságával" mondata a bare "hosszúság"/"szélesség" címkével
    // KEZDŐDŐ ragozott alakok miatt hamisan illeszkedett — a hossz mezőbe a
    // szélesség (84), a szélesség mezőbe a vastagság (15) értéke került.
    const specs = parseSpecsFromText(
      "Ezt a modellt kifejezetten a családoknak terveztek. " +
        "366 cm hosszúságával, 84 cm szélességével és 15 cm vastagságával " +
        "támogatja a stabilitást.\n" +
        "Hosszúság 366 cm \n Szélesség 84 cm \n Vastagság 15 cm",
    );
    expect(specs.lengthCm).toBe(366);
    expect(specs.widthCm).toBe(84);
    expect(specs.thicknessCm).toBe(15);
  });

  it("a 'méret' címke birtokos alakjai (mérete/méretei) TOVÁBBRA IS illeszkednek", () => {
    // A ragozott-alak-védelem SZŰK (csak instrumentális -val/-vel), nem
    // zárhatja ki a "méret" tő birtokos ragozásait — ezek a szokásos
    // címke-forma sok boltnál (élesben mért: aquamarinahungary.com).
    expect(parseSpecsFromText("Mérete: 320 x 81 x 15 cm").lengthCm).toBe(320);
    const specs = parseSpecsFromText("Méretei: 381 x 79 cm\nVastagság 15 cm");
    expect(specs.lengthCm).toBe(381);
    expect(specs.widthCm).toBe(79);
    expect(specs.thicknessCm).toBe(15);
  });

  it("csak hossz×szélesség PÁR (vastagság nélkül) a 'méretei' címke alatt is kitölti a hosszt/szélességet", () => {
    // Élesben mért eset (2026-08-15, aquamarinahungary.com HYPER 381cm): a
    // "paddleboard méretei: 381 x 79 cm" csak 2 számot ad (a vastagság
    // KÜLÖN "deszka vastagság" címkével jön) — a 3-számos parseTripleDimensionCm
    // ilyenkor hallgat, a pár-fallback tölti ki a hosszt/szélességet.
    const specs = parseSpecsFromText(
      "paddleboard méretei: 381 x 79 cm \n deszka vastagság: 15 cm",
    );
    expect(specs.lengthCm).toBe(381);
    expect(specs.widthCm).toBe(79);
    expect(specs.thicknessCm).toBe(15);
  });

  it("a szállítási/csomagolási méret (NEM a deszka mérete) kizárva a hármas- és a pár-fallbackből is", () => {
    // Élesben mért hiba (2026-08-15, aquamarinahungary.com HYPER 381cm): a
    // "szállítási méretei: 38x20x85 cm" (dobozméret) korábban tévesen a
    // deszka méretének minősült, mert a "szállítás" szó nem volt kizárva.
    const specs = parseSpecsFromText(
      "paddleboard szállítási méretei: 38x20x85 cm \n leírás vége",
    );
    expect(specs.lengthCm).toBeNull();
    expect(specs.widthCm).toBeNull();
    expect(specs.thicknessCm).toBeNull();
  });

  it("magyar 'Mérete (L x W x H cm)' címke is felismert (nem csak 'Méretek')", () => {
    // Élesben mért: aquamarinahungary.com a "Mérete" (nem "Méretek") szót írja.
    const specs = parseSpecsFromText("Mérete (366 x 84 x 15 cm)\nNettó súly 10.5kg");
    expect(specs.lengthCm).toBe(366);
    expect(specs.widthCm).toBe(84);
    expect(specs.thicknessCm).toBe(15);
    expect(specs.weightKg).toBe(10.5);
  });

  it("CÍMKE NÉLKÜLI 'NNNxNNxNN cm' hármast is felismeri, ha a címkézett próbálkozás elgépelt egységgel elhasal", () => {
    // Élesben mért eset (aquamarinahungary.com): a "Mérete" címke UTÁN elgépelt
    // "m" egység áll ("Mérete (366m x 84x 15m)", parseolhatatlan), de a leírás
    // korábbi mondatában UGYANEZ a hármas helyes "cm" egységgel, címke nélkül
    // is szerepel — ez a fallback ezt találja meg.
    const specs = parseSpecsFromText(
      "AZ új MONSTER ISUP, Aqua Marina, 366x84x15 cm\nMérete (366m x 84x 15m)\nNettó súly 10.5kg",
    );
    expect(specs.lengthCm).toBe(366);
    expect(specs.widthCm).toBe(84);
    expect(specs.thicknessCm).toBe(15);
  });

  it("a címke nélküli fallback SEM keveri össze a Bag Dimensionst a deszkával", () => {
    const specs = parseSpecsFromText("Board Weight: 9.1kg\nBag Dimensions: 90 x 40 x20cm");
    expect(specs.lengthCm).toBeNull();
    expect(specs.widthCm).toBeNull();
    expect(specs.thicknessCm).toBeNull();
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

/**
 * MAGYAR SZÓREND a spec-mondatokban (F2.1-utó-36, sup-deszka.hu).
 *
 * A magyar ragozás miatt az érték gyakran a címke ELŐTT áll („150 kg
 * teherbírással"), és a címke UTÁN már a következő állítás száma jön. Ez
 * élesben a teherbírásba a deszka SÚLYÁT írta — 8,8 kg a valós 150 helyett.
 */
describe("címke és érték sorrendje", () => {
  it("a ragozott címke ELŐTTI érték nyer a mögötte álló szám ellenében", () => {
    const specs = parseSpecsFromText(
      "Pure Air FREEDOM 11’ SUP deszka 335 x 84 x 15 cm méretben, max. 150 kg " +
        "teherbírással és mindössze 8,8 kg súllyal.",
    );
    expect(specs.maxLoadKg).toBe(150);
  });

  it("ÍRÁSJEL megállítja: a vessző előtti érték a szomszéd mezőé", () => {
    // „…330 x 81 x 15 cm, teherbírás max. 160 kg" — a 15 cm a VASTAGSÁG.
    const specs = parseSpecsFromText(
      "TooMuch TIDE SUP deszka 330 x 81 x 15 cm, teherbírás max. 160 kg, 15 PSI.",
    );
    expect(specs.maxLoadKg).toBe(160);
    expect(specs.thicknessCm).toBe(15);
  });

  it("a KETTŐSPONT után álló érték nyer a címke előtti szomszéd ellenében", () => {
    // Egy sorba írt spec (zraysports.com): a `Capacity:` előtt a térfogat áll.
    const specs = parseSpecsFromText("Volume: 379L Capacity: up to 170 kg/374 lb");
    expect(specs.maxLoadKg).toBe(170);
    expect(specs.volumeL).toBe(379);
  });

  it("a MAGYAR BIRTOKOS toldalék is kettőspontos címke", () => {
    // Élesben (aquamarinahungary.com): a `paddleboard súlya:` nem számított
    // kettőspontosnak, ezért a lap alján álló EVEZŐ `Súly:` címkéje nyert, és
    // a deszka súlya üresen maradt.
    const specs = parseSpecsFromText(
      "paddleboard súlya: 11 kg\npaddleboard terhelhetősége: 180 kg\nSúly:\n900g",
    );
    expect(specs.weightKg).toBe(11);
    expect(specs.maxLoadKg).toBe(180);
  });

  it("a címke SOR ELEJÉN: az előző sor értéke nem szivárog át", () => {
    const specs = parseSpecsFromText("Teherbírás\n150 kg\nSúly\n8,8 kg");
    expect(specs.maxLoadKg).toBe(150);
    expect(specs.weightKg).toBe(8.8);
  });
});

describe("boardTypeFromProse", () => {
  // A PRÓZA más, mint a cím: ott a kategória-szó úti célt is jelenthet. Ezért
  // itt FŐNÉV kell a kulcsszó mellé — a `guessBoardType` laza listája a
  // címre/URL-slugra való.
  it.each([
    // Élesben mért HIBA (sup-deszka.hu, TooMuch TIDE): a mondat három vizet
    // sorol fel, tehát épp NEM vadvízi deszkáról beszél.
    ["ideális tengerre, tóra vagy folyóra", null],
    // Sorolás angolul: a kötőszó megállítja a mintát, hiába jön főnév.
    ["great for river or lake board sessions", null],
    // Jelző ékelődik a kategória-szó és a főnév közé (bluefinsupboards.eu).
    ["a lightweight all-round inflatable paddleboard", "allround"],
    // Magyar szórend és összetett szó.
    ["kiváló túra deszka hosszabb kirándulásokhoz", "touring"],
    ["egy igazi versenydeszka a profiknak", "race"],
    ["ez egy vadvízi deszka", "river"],
    ["gyerek SUP deszka 8 éves kortól", "kids"],
    // Két kimondott kategória = nincs döntés, a moderátoré a szó.
    ["túra deszka és verseny deszka egyben", null],
    // Kulcsszó főnév nélkül: nem besorolás.
    ["kezdőknek és rekreációhoz", null],
  ])("%s → %s", (text, expected) => {
    expect(boardTypeFromProse(text)).toBe(expected);
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
    // Élesben mért eset (Indiana Paddle & Surf): a hordtáska nevében a "board"
    // szó a BOARD_NOUNS-on át DESZKÁVÁ minősítette volna, mert a "taska"
    // kategória csak magyar kulcsszavakat ismert. Táska ma nem KÖVETETT →
    // `ignore` (nem `board`, nem hamis jelölt).
    ["11'6 Touring Board Bag", null, { kind: "ignore" }],
    ["12'6 Board Bag", null, { kind: "ignore" }],
    // Ugyanaz a "board"-szótő-csapda, más termékkategóriában.
    ["Férfi rövidnadrág Maui Férfi Boardshorts SUP", null, { kind: "ignore" }],
    ["Race Board Handle (1 pcs)", null, { kind: "ignore" }],
    ["Foil Board Nose Handle (1 pcs)", null, { kind: "ignore" }],
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

  it("brand/manufacturer nélküli JSON-LD-nél a defaultBrandName pótolja a márkát", () => {
    const noBrand = { ...NODE, brand: undefined };
    const product = extractProduct(noBrand, "https://indiana-paddlesurf.com/x", "", "Indiana");
    expect(product?.brandName).toBe("Indiana");
  });

  it("a JSON-LD saját brand mezője ELSŐBBSÉGET élvez a defaultBrandName-nél", () => {
    const product = extractProduct(NODE, "https://bolt.hu/x", "", "Fallback Brand");
    expect(product?.brandName).toBe("Aqua Marina");
  });

  it("defaultBrandName nélkül (és JSON-LD brand nélkül) a márka null marad", () => {
    const noBrand = { ...NODE, brand: undefined };
    expect(extractProduct(noBrand, "https://bolt.hu/x")?.brandName).toBeNull();
  });

  it("a navigációs menü szövege (pageText) NEM szennyezheti a boardType-ot", () => {
    // Élesben mért eset (aquamarinahungary.com): a bolt navigációja minden
    // oldalon (ruházaton is) tartalmazza a "Touring"/"Race"/"Yoga" kategória-
    // neveket — ha a boardType-tippet a TELJES oldalszövegből számolnánk,
    // ez BÁRMELY "SUP"-ot említő terméket (pl. ruhát) deszkává minősítené a
    // `hasSup && boardType !== null` ágon át.
    const shortsNode = {
      "@type": "Product",
      name: "Aqua Marina Női SUP rövidnadrág ILLUSION PINK",
      description: "Gyorsan száradó SUP rövidnadrág.",
    };
    const navChrome =
      "Kezdőlap Touring SUP Race SUP Yoga SUP Allround SUP Kosár Kapcsolat";
    const product = extractProduct(shortsNode, "https://bolt.hu/x", navChrome);
    expect(product?.boardType).toBeNull();
    expect(
      classifyProduct({
        rawTitle: product!.rawTitle,
        modelName: product!.modelName,
        boardType: product!.boardType,
        specs: product!.specs,
      }),
    ).toEqual({ kind: "ignore" });
  });
});

/**
 * Aqua Marina HIVATALOS adatlap (aquamarina.com/products/glowing/blaze,
 * 2026-08-19). Az oldal Elementor-widgetekben, címke–érték párokban közli a
 * specifikációt — a szövegé alakja pontosan ez. A gyártó a font-értéket is
 * kiírja, ezért a `kg` kötelező: a 308 lbs SOHA nem kerülhet a teherbírásba.
 */
describe("parseSpecsFromText — Aqua Marina gyártói adatlap", () => {
  const BLAZE = [
    "BLAZE",
    "Size: 10'4\"",
    "PRODUCT",
    "BLAZE 10'4\"",
    "MODEL",
    "BT-26BZ",
    "NET WEIGHT",
    "20.5 lbs / 9.3 kg",
    "LENGTH",
    "10'4\" / 315 cm",
    "WIDTH",
    "31\" / 79 cm",
    "THICKNESS",
    "6\" / 15 cm",
    "VOLUME",
    "315 L",
    "MAX. PAYLOAD",
    "308 lbs / 140 kg",
    "MAX. AIR PRESSURE",
    "15 psi",
  ].join("\n");

  it("mind a hat mérőszámot kiolvassa", () => {
    expect(parseSpecsFromText(BLAZE)).toMatchObject({
      lengthCm: 315,
      widthCm: 79,
      thicknessCm: 15,
      volumeL: 315,
      weightKg: 9.3,
      maxLoadKg: 140,
    });
  });

  it("a `MAX. PAYLOAD` font-értékét NEM veszi teherbírásnak", () => {
    expect(parseSpecsFromText(BLAZE).maxLoadKg).not.toBe(308);
  });

  it("a `NET WEIGHT` a deszka súlya, nem a teherbírás", () => {
    const specs = parseSpecsFromText(BLAZE);
    expect(specs.weightKg).toBe(9.3);
    expect(specs.maxLoadKg).toBe(140);
  });
});

/**
 * JSON-LD NÉLKÜLI gyártói oldal (F2.1-utó-17). Élesben mért: aquamarina.com —
 * 0 JSON-LD, de a specifikáció címkézett szövegként ott van.
 */
describe("extractProductFromPage", () => {
  const BLAZE_PAGE = `<html><head><title>Blaze – Aqua Marina</title></head><body>
    <p>PRODUCT</p><p>BLAZE 10'4"</p>
    <p>NET WEIGHT</p><p>20.5 lbs / 9.3 kg</p>
    <p>LENGTH</p><p>10'4" / 315 cm</p>
    <p>WIDTH</p><p>31" / 79 cm</p>
    <p>THICKNESS</p><p>6" / 15 cm</p>
    <p>VOLUME</p><p>315 L</p>
    <p>MAX. PAYLOAD</p><p>308 lbs / 140 kg</p>
  </body></html>`;

  it("a címből és az oldalszövegből teljes jelöltet épít", () => {
    const product = extractProductFromPage(BLAZE_PAGE, "https://aquamarina.com/x", "Aqua Marina");
    expect(product?.brandName).toBe("Aqua Marina");
    expect(product?.modelName).toBe("Blaze");
    expect(product?.specs).toMatchObject({
      lengthCm: 315,
      widthCm: 79,
      thicknessCm: 15,
      volumeL: 315,
      weightKg: 9.3,
      maxLoadKg: 140,
    });
  });

  it("gyártói forrás: árat SOHA nem ad", () => {
    expect(extractProductFromPage(BLAZE_PAGE, "https://x.com/y", "Aqua Marina")?.priceHuf).toBeNull();
  });

  it("HOSSZ nélküli oldalból nem csinál jelöltet (blog, kategória)", () => {
    const blog = `<html><head><title>SUP tippek kezdőknek – Aqua Marina</title></head>
      <body><p>Néhány jó tanács a kezdéshez.</p></body></html>`;
    expect(extractProductFromPage(blog, "https://x.com/blog", "Aqua Marina")).toBeNull();
  });

  it("cím nélküli oldalra null", () => {
    expect(extractProductFromPage("<html><body>x</body></html>", "https://x.com", "A")).toBeNull();
  });
});

/**
 * ÉLESBEN MÉRT HIBA (2026-08-19, aquamarina.com): kajakok kerültek be
 * deszka-jelöltként. A `classifyProduct` első szabálya rövidre zár
 * („deszka-tartományú hossz + teherbírás → deszka"), márpedig egy kajak
 * pontosan ilyen. Ugyanazok a termékek, amiket korábban kézzel kellett
 * elutasítani a bolti forrásokból.
 */
describe("classifyProduct — ami SOSEM deszka", () => {
  const kayakSpecs = {
    lengthCm: 398.8,
    widthCm: 98,
    thicknessCm: null,
    volumeL: null,
    weightKg: 7.4,
    maxLoadKg: 180,
    inflatable: true,
  };

  it("a kajakot a MÉRET ellenére sem veszi deszkának, ha a neve elárulja", () => {
    expect(
      classifyProduct({
        rawTitle: "Aqua Marina Halve kajak",
        modelName: "Halve",
        boardType: null,
        specs: kayakSpecs,
      }),
    ).toEqual({ kind: "ignore" });
  });

  it("az URL-ből jövő kategória-jel is elég a kizáráshoz", () => {
    // A cím önmagában ártatlan („Halve"), a kategória viszont árulkodó.
    expect(
      classifyProduct({
        rawTitle: "Halve",
        modelName: "Halve",
        boardType: null,
        specs: kayakSpecs,
        classificationHint: "/products/reinforced-kayak/betta/",
      }),
    ).toEqual({ kind: "ignore" });
  });

  it("a gyűjtő-/kategórialapot sem veszi terméknek", () => {
    expect(
      classifyProduct({
        rawTitle: "Equipment",
        modelName: "Equipment",
        boardType: null,
        specs: { ...kayakSpecs, lengthCm: 165, maxLoadKg: null },
        classificationHint: "/products/sup-equipment/",
      }),
    ).toEqual({ kind: "ignore" });
  });

  it("a VALÓDI deszkát változatlanul átengedi", () => {
    expect(
      classifyProduct({
        rawTitle: "Blaze",
        modelName: "Blaze",
        boardType: "allround",
        specs: { ...kayakSpecs, lengthCm: 315, volumeL: 315, maxLoadKg: 140 },
        classificationHint: "/products/glowing/blaze/",
      }),
    ).toEqual({ kind: "board" });
  });
});

/**
 * A gyártói oldal SAJÁT alcíme a megbízható kategória-jel (F2.1-utó-17).
 * A teljes oldalszöveg használhatatlan: a navigáció minden oldalon felsorolja
 * a „Kayak" kategóriát is (élesben mérve a Blaze DESZKA oldalán is 31 „kayak"
 * szó van) — a szűk, spec-blokk előtti ablak viszont tiszta.
 */
describe("extractProductFromPage — kajak vs. deszka az alcím alapján", () => {
  function page(headline: string, title: string): string {
    // A navigáció a valódi oldalakon a dokumentum TETEJÉN van, jóval a
    // termék-fejléc előtt — a köztes szöveg ezt a távolságot modellezi.
    return `<html><head><title>${title} – Aqua Marina</title></head><body>
      <p>SUP Kayak Canoe Accessories</p>
      <p>${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6)}</p>
      <p>Find a Service Provider Connect Get Help Become a Dealer</p>
      <p>${headline}</p>
      <p>PRODUCT</p><p>${title}</p>
      <p>LENGTH</p><p>13'1" / 398.8 cm</p>
      <p>WIDTH</p><p>38" / 98 cm</p>
      <p>MAX. PAYLOAD</p><p>396 lbs / 180 kg</p>
    </body></html>`;
  }

  it("a `RECREATIONAL KAYAK` alcímű terméket kizárja a méret ellenére", () => {
    const product = extractProductFromPage(
      page("LAXO RECREATIONAL KAYAK Sizes: 9'4\"", "Laxo"),
      "https://aquamarina.com/products/heavy-duty/laxo/",
      "Aqua Marina",
    );
    expect(product).toBeNull();
  });

  it("a `RECREATIONAL CANOE` alcímű terméket is kizárja", () => {
    expect(
      extractProductFromPage(
        page("RIPPLE RECREATIONAL CANOE Sizes: 12'2\"", "Ripple"),
        "https://aquamarina.com/products/ripple/",
        "Aqua Marina",
      ),
    ).toBeNull();
  });

  it("a DESZKÁT átengedi, pedig a navigációban ott a `Kayak` szó", () => {
    const product = extractProductFromPage(
      page("BLAZE glowing series Size: 10'4\"", "Blaze"),
      "https://aquamarina.com/products/glowing/blaze/",
      "Aqua Marina",
    );
    expect(product?.modelName).toBe("Blaze");
  });
});

/**
 * „TRANSZPONÁLT" spec-blokk (F2.1-utó-18, élesben mért: aquamarina.com/nuts).
 * A lap két hasábban közli a specifikációt — előbb MINDEN címke, utána MINDEN
 * érték —, ezért a szokásos „címke után 40 karakterrel" keresés a következő
 * CÍMKÉT találja érték helyett, és mind a hat mező üresen maradna.
 */
describe("extractProductFromPage — két hasábos (transzponált) spec-blokk", () => {
  const NUTS = `<html><head><title>Nuts – Aqua Marina</title></head><body>
    <p>NUTS RENTAL series Sizes: 10'6"</p>
    <div><p>MODEL</p><p>PRODUCT</p><p>LENGTH</p><p>WIDTH</p><p>THICKNESS</p>
         <p>VOLUME</p><p>NET WEIGHT</p><p>MAX. PAYLOAD</p><p>MAX. AIR PRESSURE</p></div>
    <div><p>NUTS 10'6"</p><p>AM-20NU</p><p>10'6" / 320cm</p><p>32" / 81cm</p><p>6" / 15cm</p>
         <p>300L</p><p>20.1lbs / 9.1kg</p><p>308lbs / 140kg</p><p>15 psi</p></div>
  </body></html>`;

  it("a címke- és érték-hasábot pozíció szerint párosítja", () => {
    const product = extractProductFromPage(NUTS, "https://aquamarina.com/products/nuts/", "Aqua Marina");
    expect(product?.specs).toMatchObject({
      lengthCm: 320,
      widthCm: 81,
      thicknessCm: 15,
      volumeL: 300,
      weightKg: 9.1,
      maxLoadKg: 140,
    });
  });

  it("a font-értéket itt sem veszi kilogrammnak", () => {
    const specs = extractProductFromPage(NUTS, "https://x.com/y", "Aqua Marina")?.specs;
    expect(specs?.weightKg).not.toBe(20.1);
    expect(specs?.maxLoadKg).not.toBe(308);
  });

  it("hiányos érték-hasábnál NEM párosít (inkább hiányozzon, mint tévedjen)", () => {
    // Az érték-hasáb hiányos ÉS nincs benne értelmezhető méret — így a
    // szokásos parse sem tud véletlenül belebotlani egybe.
    const truncated = `<html><head><title>Csonka – Aqua Marina</title></head><body>
      <div><p>MODEL</p><p>PRODUCT</p><p>LENGTH</p><p>WIDTH</p><p>THICKNESS</p><p>VOLUME</p></div>
      <div><p>AM-1</p></div>
    </body></html>`;
    expect(extractProductFromPage(truncated, "https://x.com/y", "Aqua Marina")).toBeNull();
  });
});

/**
 * HTML-entitás a modellnévben (élesben mért: a Shopify /products.json és a
 * JSON-LD `name` mezője is ad entitást). Enélkül az `&#039;` NYERSEN kerülne
 * a katalógusba: „Indiana 12&#039;6 Touring".
 */
describe("cleanModelName — HTML-entitások", () => {
  it("feloldja az aposztróf-entitást, és a méretet utána vágja le", () => {
    expect(cleanModelName("Indiana 12&#039;6 Touring", "Indiana")).toBe("Touring");
  });

  it("a nevesített entitásokat is kezeli", () => {
    expect(cleanModelName("Aqua Marina Vapor &amp; Co", "Aqua Marina")).toBe("Vapor & Co");
  });
});

/**
 * Élesben mért besorolási hibák a kiegészítőknél (2026-08-20): az
 * „evezőtáska" és az „evezőtartó" a substring miatt EVEZŐNEK látszott, pedig
 * az egyik táska, a másik rögzítő — egyik sem a követett három kategória.
 */
describe("classifyProduct — evezőtáska és evezőtartó nem evező", () => {
  const base = { boardType: null, specs: { ...EMPTY_SPECS } };

  it("az evezőtáska nem kerül a jelölt-sorba evezőként", () => {
    const result = classifyProduct({
      ...base,
      rawTitle: "Aqua Marina evezőtáska fekete",
      modelName: "evezőtáska fekete",
    });
    expect(result).toEqual({ kind: "ignore" });
  });

  it("az evezőtartó sem", () => {
    const result = classifyProduct({ ...base, rawTitle: "Aqua Marina Evezőtartó", modelName: "Evezőtartó" });
    expect(result).toEqual({ kind: "ignore" });
  });

  it("a VALÓDI evező viszont átmegy", () => {
    const result = classifyProduct({
      ...base,
      rawTitle: "Aqua Marina SOLID evező, 220 cm",
      modelName: "SOLID evező",
    });
    expect(result).toEqual({ kind: "accessory", accessoryType: "evezo" });
  });
});

/**
 * ZRAY-KÖR (2026-08-20) — négy hiba, mind a `zraysports.com` bekötése közben
 * mérve. Kettő közülük a MEGLÉVŐ forrásokat is érintő, csendes hiba volt.
 */
describe("zraysports.com — a spec-blokk a marketing-próza MÖGÖTT", () => {
  /**
   * A termékoldalon a „Related Products" blokk MEGELŐZI a spec-táblát, és MÁS
   * deszkákról ír. A laza címke-illesztés emiatt a szomszéd termék adatát
   * vette: 170 kg helyett 152 kg-ot. A teherbírás BIZTONSÁGI mező.
   */
  it("a KETTŐSPONTOS spec-címke üt a próza szabad szóhasználatán", () => {
    const text =
      "[HIGHER VOLUME; CAPACITY] The weight capacity is 152 kg/335 lb, 22 kg higher. " +
      "Specification Length: 351 cm Width: 86 cm Thickness: 15 cm Volume: 379L " +
      "Capacity: up to 170 kg/374 lb";
    const specs = parseSpecsFromText(text);
    expect(specs.maxLoadKg).toBe(170);
    expect(specs.volumeL).toBe(379);
  });

  it("kettőspont nélküli spec-tábla továbbra is működik (aquamarina.com)", () => {
    const specs = parseSpecsFromText("LENGTH\n320 cm\nMAX. PAYLOAD\n140 kg");
    expect(specs.lengthCm).toBe(320);
    expect(specs.maxLoadKg).toBe(140);
  });

  /**
   * CSENDES, ÁLTALÁNOS HIBA: a `foldText` NFD-bontása a hangul szótagoknál nem
   * hossz-semleges, ezért a hajtott szövegben talált index az EREDETI szöveget
   * elcsúszva vágta. A Zray az ikonjaihoz használ ilyen karaktert (`&#xb133;`),
   * és emiatt a „Volume: 379L" ablak „9L"-ként indult → 9 liter.
   */
  it("a címke-index NEM csúszik el nem hossz-semlegesen bomló karaktertől", () => {
    const specs = parseSpecsFromText("넳 넲 ikonok Volume: 379L Capacity: up to 170 kg");
    expect(specs.volumeL).toBe(379);
    expect(specs.maxLoadKg).toBe(170);
  });

  it("a HASONLAT nem tesz keménnyé egy felfújható deszkát", () => {
    // „…makes rider feel just like paddling on a hardboard" — épp az
    // ellenkezőjét mondja annak, amit a puszta szó-illesztés kiolvasna.
    expect(
      detectInflatable("Drop Stitch Core. It makes rider feel just like paddling on a hardboard."),
    ).toBe(true);
    // Valódi állításra viszont továbbra is kemény deszka:
    expect(detectInflatable("Hardboard construction, epoxy shell")).toBe(false);
  });

  it("a szerkezeti jel is elárulja a felfújhatót (drop stitch, nagynyomású szelep)", () => {
    expect(detectInflatable("I-Drop Stitch Core and a High Pressure Valve")).toBe(true);
  });

  it("a cím OLDAL-SZINTŰ utótagja levágható (titleSuffixes)", () => {
    const page = `<html><head><title>Max Azure 11'6" - M2-A-Zray Official Site</title></head>
      <body>Specification Length: 351 cm Width: 86 cm Thickness: 15 cm Volume: 379L
      Capacity: up to 170 kg</body></html>`;
    const product = extractProductFromPage(page, "https://www.zraysports.com/productinfo/1.html", "Zray", {
      titleSuffixes: ["-Zray Official Site"],
    });
    expect(product?.modelName).toBe("Max Azure M2 A");
  });

  it("a PROTOKOLL-RELATÍV kép-URL abszolúttá válik", () => {
    const page = `<html><head><title>Max Azure</title></head><body>
      Length: 351 cm Width: 86 cm Thickness: 15 cm
      <img src="//img.website.xin/contents/max-azure.png">
      </body></html>`;
    const product = extractProductFromPage(page, "https://www.zraysports.com/productinfo/1.html", "Zray");
    expect(product?.imageUrl).toBe("https://img.website.xin/contents/max-azure.png");
  });
});

describe("classifyProduct — az ellentmondó méret nem tesz deszkává", () => {
  const base = {
    boardType: null,
    specs: {
      lengthCm: 396.2,
      widthCm: 396.2,
      thicknessCm: null,
      volumeL: null,
      weightKg: null,
      maxLoadKg: 150,
      inflatable: null,
    },
  };

  /**
   * Élesben (zraysports.com): a kiegészítő-oldalakon nincs saját spec-blokk, a
   * „Related Products" viszont SUP-deszkákat sorol fel — onnan szivárgott be a
   * méret. Minden kiegészítő „396,2 × 396,2 cm, 150 kg" deszkaként jött volna.
   */
  it("evező NEM deszka attól, hogy a szomszéd termék méretét felszedte", () => {
    expect(
      classifyProduct({ ...base, rawTitle: "ALUMINUM OARS", modelName: "Aluminum Oars" }),
    ).toEqual({ kind: "accessory", accessoryType: "evezo" });
  });

  it("póráz akkor is kimarad, ha deszka-méretet mértünk rá", () => {
    expect(classifyProduct({ ...base, rawTitle: "LEASH", modelName: "Leash" })).toEqual({
      kind: "ignore",
    });
  });

  it("a HELYES arányú deszka-adat továbbra is azonnal deszka", () => {
    expect(
      classifyProduct({
        ...base,
        rawTitle: "Max Azure 11'6",
        modelName: "Max Azure",
        specs: { ...base.specs, lengthCm: 350.5, widthCm: 86, volumeL: 379, maxLoadKg: 170 },
      }),
    ).toEqual({ kind: "board" });
  });

  it("szélesség nélküli, de hihető adat továbbra is deszka (nem szigorítunk feleslegesen)", () => {
    expect(
      classifyProduct({
        ...base,
        rawTitle: "Touring 12'6",
        modelName: "Touring",
        specs: { ...base.specs, lengthCm: 381, widthCm: null, volumeL: 300, maxLoadKg: 140 },
      }),
    ).toEqual({ kind: "board" });
  });
});

/**
 * GLADIATOR-KÖR (2026-08-20) — két hiba a `gladiatorsup.com` felmérése közben.
 * Az első CSENDES ADATHIBA volt: nem hiányzó, hanem HAMIS értéket adott.
 */
describe("gladiatorsup.com — zárójeles címke-magyarázat és cirill szorzójel", () => {
  const SPEC = "Pressure\nmax 26 psi\nDimensions (length/width/thickness)\n354 х 86 х 15 cm\nWarranty\n36 months";

  /**
   * A méret-sor címkéje `Dimensions (length/width/thickness)`, és a zárójelben
   * ott a „length", „width", „thickness" szó is. A címke-kereső ezeket VALÓDI
   * címkének vette, és mind a három mezőbe ugyanazt a 15-öt írta:
   * 354 × 86 × 15 helyett 15 × 15 × 15.
   */
  it("a zárójelben álló címkeszó MAGYARÁZAT, nem címke", () => {
    const specs = parseSpecsFromText(SPEC);
    expect(specs.lengthCm).toBe(354);
    expect(specs.widthCm).toBe(86);
    expect(specs.thicknessCm).toBe(15);
  });

  /**
   * A `354 х 86 х 15` szorzójele CIRILL „х" (U+0445), nem latin `x` —
   * vizuálisan megkülönböztethetetlen, tehát a forrás oldalán ez nem is
   * „hiba", amit kijavítanának.
   */
  it("a CIRILL szorzójelet is felismeri", () => {
    const specs = parseSpecsFromText("Dimensions\n354 х 86 х 15 cm");
    expect(specs.lengthCm).toBe(354);
  });

  it("a címke utáni zárójeles magyarázat nem nyeli el az értéket", () => {
    // Enélkül a szűk ablakból már csak „354 х 86 х 1" fért volna bele, és a
    // hármas minta (ami mértékegységet KÖVETEL) nem illeszkedett volna.
    expect(parseSpecsFromText("Dimensions (l/w/t) 354 х 86 х 15 cm").lengthCm).toBe(354);
  });

  it("a zárójelen KÍVÜLI címke továbbra is működik", () => {
    expect(parseSpecsFromText("Length: 320 cm (a farokig mérve)").lengthCm).toBe(320);
  });
});

/**
 * JOBE-KÖR (2026-08-20). A `jobesports.com` méret-sora EGYIK meglévő mintára
 * sem illeszkedett, pedig a teljes adat ott van.
 */
describe("jobesports.com — értékenkénti mértékegység és kettős írásmód", () => {
  /**
   * `Dimensions: 8'6" x 28" x 4,75" | 2,59m x 71,12cm x 12cm`
   * Az imperiális részen hüvelyk-JEL áll (nem „inch" szó), a metrikus rész
   * pedig KEVERT egységű (m, cm, cm) — a záró-egységes hármas minta egyiket
   * sem fogja meg. A megoldás a meglévő, egy-értékes `parseDimensionCm`
   * darabonként.
   */
  it("kevert mértékegységű hármast is kiolvas", () => {
    const specs = parseSpecsFromText(`Dimensions: 8'6" x 28" x 4,75" | 2,59m x 71,12cm x 12cm`);
    expect(specs.lengthCm).toBe(259.1);
    expect(specs.widthCm).toBe(71.1);
    expect(specs.thicknessCm).toBe(12.1);
  });

  /**
   * A `|` UGYANAZT a méretet írja le kétféleképp. Enélkül a harmadik darab
   * (`4,75" | 2,59m`) a MÁSIK írásmód HOSSZÁT adta vastagságként: 259 cm.
   */
  it("a `|` utáni MÁSIK írásmód nem szivárog be a harmadik értékbe", () => {
    const specs = parseSpecsFromText(`Dimensions: 11'6" x 31" x 6" | 3,50m x 78,74cm x 15,24cm`);
    expect(specs.thicknessCm).toBe(15.2);
    expect(specs.thicknessCm).not.toBe(350);
  });

  it("mértékegység NÉLKÜLI darabból továbbra sem találgat", () => {
    expect(parseSpecsFromText("Dimensions: 350 x 79 x 15").lengthCm).toBeNull();
  });

  it("a záró-egységes klasszikus alak változatlanul működik", () => {
    expect(parseSpecsFromText("Dimensions: 325 x 82 x 16 cm").lengthCm).toBe(325);
  });
});

/**
 * CIKKSZÁM-HORGONY (2026-08-20). A jobesports.com termékoldalán a képek a
 * cikkszámmal vannak nevesítve, és a cikkszám ott van a termék URL-jében is.
 */
describe("jobesports.com — cikkszám-horgony a képhez és a galériához", () => {
  const PAGE = `<html><head><title>Jobe Aero Sava Sup Lite Board 8.6 Package - Jobesports.com</title></head>
    <body>
      <img src="/images/basket-2018.png">
      <img src="/images/logo.png">
      Dimensions: 8'6" x 28" x 4,75" | 2,59m x 71,12cm x 12cm
      Recommended rider weight: Up to 80kg
      <img src="/uploads/product/486425010-big.jpg">
      <img src="/uploads/product/486425010-2-big.jpg">
      <img src="/uploads/product/486425010-3-big.jpg">
      <img src="/uploads/product/999999999-big.jpg">
    </body></html>`;
  const URL_ = "https://www.jobesports.com/en/jobe-aero-sava-sup-lite-board-86-package-486425010/";

  /** Enélkül a pozíció-fallback a fejléc KOSÁR-IKONJÁT adta termékképnek. */
  it("a cikkszám üt a pozíció-fallbackön", () => {
    const product = extractProductFromPage(PAGE, URL_, "Jobe");
    expect(product?.imageUrl).toBe("https://www.jobesports.com/uploads/product/486425010-big.jpg");
  });

  it("a galéria CSAK az azonos cikkszámú képeket veszi", () => {
    const product = extractProductFromPage(PAGE, URL_, "Jobe");
    // A borító nem ismétlődik, és a szomszéd termék (999999999) kimarad.
    expect(product?.imageUrls).toEqual([
      "https://www.jobesports.com/uploads/product/486425010-2-big.jpg",
      "https://www.jobesports.com/uploads/product/486425010-3-big.jpg",
    ]);
  });

  it("cikkszám nélküli URL-en NINCS galéria (nem tippelünk pozícióból)", () => {
    const product = extractProductFromPage(PAGE, "https://x.com/termek/sava/", "Jobe");
    expect(product?.imageUrls).toEqual([]);
  });

  /**
   * A „Recommended rider weight" a Jobe EGYETLEN terhelési korlátja, és a
   * felhasználó döntése szerint ezt vesszük teherbírásnak (konzervatív:
   * alacsonyabb, mint a felszerelést is beleértő teljes terhelhetőség).
   */
  it("a Recommended rider weight teherbírásként jön be", () => {
    expect(extractProductFromPage(PAGE, URL_, "Jobe")?.specs.maxLoadKg).toBe(80);
  });
});

/**
 * MÉRTÉKEGYSÉG NÉLKÜLI kétoszlopos spec-tábla (2026-08-20, gladiatorsup.com).
 * A gyártó KÖZLI a térfogatot és a teherbírást, csak nem ismétli meg mellette
 * az egységet — a korábbi állapotban ezért maradtak üresen. Ez a MI korlátunk
 * volt, nem a forrásé.
 */
describe("címke a saját sorában, alatta puszta szám", () => {
  const TABLE = [
    "Board weight",
    "9,5",
    "Volume",
    "245",
    "Maximum load capacity",
    "140",
    "Recommended rider weight",
    "up to 80",
  ].join("\n");

  it("a mértékegységet a MEZŐ adja (térfogat → liter, teherbírás → kg)", () => {
    const specs = parseSpecsFromText(TABLE);
    expect(specs.volumeL).toBe(245);
    expect(specs.weightKg).toBe(9.5);
    expect(specs.maxLoadKg).toBe(140);
  });

  it("az egységes írásmód MINDIG üt (ez csak a maradékot tölti)", () => {
    const specs = parseSpecsFromText(`Volume: 300 l\nVolume\n245`);
    expect(specs.volumeL).toBe(300);
  });

  /** Prózában ez az alakzat nem fordul elő — a címke-sor rövid és szám nélküli. */
  it("hosszú prózai sorból NEM olvas értéket", () => {
    const prose = "This board has an impressive volume for its size, which matters\n245";
    expect(parseSpecsFromText(prose).volumeL).toBeNull();
  });

  it("a MÉRETEKET szándékosan nem tölti (32 hüvelyk ≠ 32 cm)", () => {
    expect(parseSpecsFromText("Length\n354\nWidth\n86").lengthCm).toBeNull();
  });

  it("nem szám értékre nem lép", () => {
    expect(parseSpecsFromText("Volume\nnagy").volumeL).toBeNull();
  });
});

/**
 * A méret-sorba ÉKELT zárójel (gladiatorsup.com): `463 х 91 (36”) х 15 cm` —
 * a `(36”)` a szélesség hüvelykben, tehát magyarázat, nem érték. Enélkül sem a
 * záró-egységes minta, sem a darabonkénti parse nem illeszkedik: a középső
 * darab két számot viselne.
 */
describe("méret-sorba ékelt zárójel", () => {
  it("a zárójeles átváltást kihagyja, a cm-es hármast olvassa", () => {
    const specs = parseSpecsFromText(`Dimensions (length/width/thickness)\n463 х 91 (36”) х 15 cm`);
    expect(specs.lengthCm).toBe(463);
    expect(specs.widthCm).toBe(91);
    expect(specs.thicknessCm).toBe(15);
  });
});

/**
 * FUNWATER-KÖR (2026-08-20). A SPECS-fül teljes adatot ad, de három olyan
 * írásmóddal, amit addig nem ismertünk.
 */
describe("funwaterboard.com — prime-jelek, csillag, font", () => {
  const SPEC = [
    "Dimensions",
    "10′6″ * 33″ * 6″  for Adults,",
    "8′ * 30″ * 4″  for Youth",
    "Capacity",
    "330LBS",
    "Weight",
    "12.5KG (10'6\"), 9.68KG (8')",
  ].join("\n");

  it("a tipográfiai PRIME-okat (′ ″) és a CSILLAG szorzójelet is érti", () => {
    const specs = parseSpecsFromText(SPEC);
    expect(specs.lengthCm).toBe(320);
    expect(specs.widthCm).toBe(83.8);
  });

  /**
   * A méret KÉT készletet ad egymás alatt (Adults / Youth). A harmadik darab
   * enélkül a MÁSODIK sor első értékét (`8′` = 244 cm) olvasta volna
   * vastagságnak a valós 6″ (15,2 cm) helyett.
   */
  it("egy ÉRTÉK nem lóghat át a következő sorra", () => {
    expect(parseSpecsFromText(SPEC).thicknessCm).toBe(15.2);
  });

  /**
   * A `Capacity` ablaka átnyúlt a KÖVETKEZŐ mezőbe, és a teherbírásba a
   * DESZKA SÚLYA került: 12,5 kg a valós 150 helyett.
   */
  it("a címke ablaka nem szivárog a következő mezőbe, és a fontot átváltja", () => {
    expect(parseSpecsFromText(SPEC).maxLoadKg).toBe(149.7);
  });

  it("ahol KG is van, az üt a fonton", () => {
    // Aqua Marina: „MAX. PAYLOAD / 308 lbs / 140 kg" — a 140 nyer.
    expect(parseSpecsFromText("MAX. PAYLOAD\n308 lbs / 140 kg").maxLoadKg).toBe(140);
  });
});

describe("márka-aliasok — ugyanaz a márka két írásmóddal", () => {
  /**
   * Élesben (sup-deszka.hu): 6 jelölt „TooMuch", 4 „Too Much". A folding a
   * szóközt nem tünteti el, tehát jóváhagyáskor KÉT külön márka jött volna
   * létre, és a deszkák két név alatt szóródtak volna szét.
   */
  it("a TooMuch és a Too Much ugyanaz", () => {
    expect(normalizeBrandName("TooMuch")).toBe("Too Much");
    expect(normalizeBrandName("Too Much")).toBe("Too Much");
  });

  it("a Zray és a Z-Ray ugyanaz", () => {
    expect(normalizeBrandName("Z-Ray")).toBe("Zray");
    expect(normalizeBrandName("ZRAY")).toBe("Zray");
  });
});

/**
 * FANATIC-KÖR (2026-08-21). A `fanatic.com` „SIZES AND SPECS" táblája
 * transzponált — ugyanaz az alak, mint az Aqua Marináé —, de két újdonsággal:
 * a címkék MÉRTÉKEGYSÉG-utótagot viselnek, és az érték mértékegység nélkül áll.
 */
describe("fanatic.com — mértékegység a CÍMKÉBEN", () => {
  const page = (body: string) =>
    `<html><head><title>FANATIC VIPER AIR</title></head><body><p>${body
      .split("\n")
      .join("</p><p>")}</p></body></html>`;

  const ONE_SIZE = [
    "SIZES AND SPECS", "BOARD", "VOLUME (L)", "WIDTH (IN / CM)", "LENGTH (IN / CM)",
    "THICKNESS (IN / CM)", "TECHNOLOGY", "WEIGHT (KG) (+/-2%)", "PACKING VOLUME (L)",
    "FITTINGS", "RECOMMENDED USER WEIGHT", "MASTFOOT INSERT",
    "VIPER AIR S|L|T", "355", `33.5" / 85.1`, `11'0" / 335.3`, `6" / 15`,
    "S|L|T (STIFF-LIGHT-TOUGH), WELDED", "11.20", "85", "2 X US BOX", "UP TO 100 KG", "YES",
  ].join("\n");

  it("a címke-utótagot levágja, és az egységet a MEZŐBŐL veszi", () => {
    const specs = extractProductFromPage(page(ONE_SIZE), "https://www.fanatic.com/en/products/x-33250-1504", "Fanatic")?.specs;
    expect(specs?.lengthCm).toBe(335.3);
    expect(specs?.widthCm).toBe(85.1);
    expect(specs?.volumeL).toBe(355); // a cella csak „355" — az egység a `VOLUME (L)` címkében
    expect(specs?.weightKg).toBe(11.2);
    expect(specs?.maxLoadKg).toBe(100); // „RECOMMENDED USER WEIGHT / UP TO 100 KG"
  });

  /**
   * A Fly Air táblája EGY címke-blokk alatt TÖBB méret értéksorát hozza. Az
   * elsőt kiolvasni félrevezető lenne: a modellt egyetlen méretével vinnénk
   * be, a többit elhallgatva. Amíg a méretenkénti bontás nincs kész, inkább
   * semmit nem adunk.
   */
  it("TÖBB MÉRETŰ táblából inkább semmit nem olvas ki", () => {
    const multi = [
      "BOARD", "VOLUME (L)", "LENGTH (IN / CM)", "WIDTH (IN / CM)", "REC. USER WEIGHT",
      `FLY AIR 9'8"`, "213", `9'8'' / 294.6`, `32'' / 81.3`, "UP TO 80 KG",
      `FLY AIR 10'4"`, "284", `10'4'' / 315`, `33" / 83.8`, "UP TO 90 KG",
    ].join("\n");
    // A hossz sem jön ki, ezért a termék EGÉSZE elesik — nem fél adattal
    // kerül a jelölt-sorba, hanem sehogy. A moderátor így látja, hogy hiányzik.
    const product = extractProductFromPage(page(multi), "https://www.fanatic.com/en/products/y-33250-1501", "Fanatic");
    expect(product).toBeNull();
  });
});

/**
 * MORZSAMENÜ-ALAPÚ BESOROLÁS (2026-08-21, zraysports.com). A termék-URL ott
 * csak sorszám (`/productinfo/854740.html`), a leírás nem mond kategóriát — a
 * morzsamenü viszont igen. A Zray 76 deszka-jelöltjéből 62 maradt enélkül
 * besorolatlanul.
 */
describe("morzsamenü mint kategória-forrás", () => {
  const page = (crumb: string, body = "Length: 351 cm Width: 86 cm Thickness: 15 cm") =>
    `<html><head><title>Max Azure</title></head><body>
      <div class="w-crumbs"><a>HOME</a> <a>${crumb}</a> <span>Max Azure 11'6"</span></div>
      <p>${body}</p></body></html>`;

  it("a morzsamenüből veszi a gyártó saját besorolását", () => {
    const p = extractProductFromPage(page("ALL AROUND EVO"), "https://x.com/productinfo/1.html", "Zray");
    expect(p?.boardType).toBe("allround");
  });

  it("a TÚRA-útvonalat is felismeri", () => {
    const p = extractProductFromPage(page("TOURING COLLECTION"), "https://x.com/productinfo/1.html", "Zray");
    expect(p?.boardType).toBe("touring");
  });

  /**
   * A teljes oldalszöveget SZÁNDÉKOSAN nem olvassuk kategóriáért: a navigációs
   * menü MINDEN kategóriát felsorol minden oldalon. A morzsamenü viszont
   * pontosan egyet — azt, ahová EZ a termék tartozik.
   */
  it("a morzsamenün KÍVÜLI kategória-felsorolás nem sorol be", () => {
    const nav = `<html><head><title>Max Azure</title></head><body>
      <nav>ALL AROUND | TOURING | RACE | YOGA</nav>
      <p>Length: 351 cm Width: 86 cm Thickness: 15 cm</p></body></html>`;
    expect(extractProductFromPage(nav, "https://x.com/productinfo/1.html", "Zray")?.boardType).toBeNull();
  });

  it("a NÉVBŐL vagy URL-ből jövő besorolás ERŐSEBB a morzsamenünél", () => {
    const p = extractProductFromPage(page("ALL AROUND EVO"), "https://x.com/products/racing/race/1.html", "Zray");
    expect(p?.boardType).toBe("race");
  });
});

/**
 * MÉRETENKÉNTI BONTÁS (F2.1-utó-35, fanatic.com). A gyártó EGY oldalon
 * sorolja fel a modellcsalád minden méretét, egyetlen spec-táblában. A SUP-nál
 * a MÉRET maga a termék (a Deszkaválasztó hossz/szélesség alapján pontoz),
 * ezért méretenként külön jelölt születik — mint a Shopify-ág variánsainál.
 */
describe("extractProductsFromPage — méretenkénti bontás", () => {
  // A `<p>SIZES AND SPECS</p>` nem dísz: enélkül a `<title>` szövege
  // ÖSSZERAGAD a tábla első sorával, és a címke-blokk elcsúszik.
  const page = (body: string, title = "FANATIC FLY AIR") =>
    `<html><head><title>${title}</title></head><body><p>SIZES AND SPECS</p><p>${body
      .split("\n")
      .join("</p><p>")}</p></body></html>`;

  const MULTI = [
    "BOARD", "VOLUME (L)", "LENGTH (IN / CM)", "WIDTH (IN / CM)", "REC. USER WEIGHT",
    `FLY AIR 9'8"`, "213", `9'8'' / 294.6`, `32'' / 81.3`, "UP TO 80 KG",
    `FLY AIR 10'4"`, "284", `10'4'' / 315`, `33" / 83.8`, "UP TO 90 KG",
  ].join("\n");

  it("méretenként KÜLÖN jelöltet ad, a gyártó saját nevével", () => {
    const products = extractProductsFromPage(page(MULTI), "https://www.fanatic.com/en/products/x-33250-1501", "Fanatic");
    expect(products).toHaveLength(2);
    expect(products[0]?.modelName).toBe(`FLY AIR 9'8"`);
    expect(products[1]?.modelName).toBe(`FLY AIR 10'4"`);
    expect(products[0]?.specs.lengthCm).toBe(294.6);
    expect(products[1]?.specs.lengthCm).toBe(315);
  });

  /**
   * A jelölt-sorokat a figyelő URL szerint azonosítja — közös URL-lel a
   * méretek felülírnák egymást a jelölt-sorban.
   */
  it("a jelölt URL-je MÉRETENKÉNT egyedi", () => {
    const products = extractProductsFromPage(page(MULTI), "https://www.fanatic.com/en/products/x-33250-1501", "Fanatic");
    const urls = products.map((p) => p.sourceUrl);
    expect(new Set(urls).size).toBe(2);
    expect(urls[0]).toContain("?size=");
  });

  it("EGY méretnél változatlanul egyetlen terméket ad, a címből vett névvel", () => {
    const single = ["BOARD", "VOLUME (L)", "LENGTH (IN / CM)", "WIDTH (IN / CM)", "REC. USER WEIGHT",
      "VIPER AIR", "355", `11'0" / 335.3`, `33.5" / 85.1`, "UP TO 100 KG"].join("\n");
    const products = extractProductsFromPage(page(single, "FANATIC VIPER AIR"), "https://www.fanatic.com/en/products/y-1.html", "Fanatic");
    expect(products).toHaveLength(1);
    expect(products[0]?.sourceUrl).not.toContain("?size=");
  });

  /** A szlogen termékenként más, ezért pontos utótagként nem adható meg. */
  it("a cím a megadott JELNÉL elvágható (titleCutAfter)", () => {
    const html = page("Length: 320 cm Width: 81 cm Thickness: 15 cm", "FANATIC FLY AIR ᐅ your all-round board!");
    const p = extractProductsFromPage(html, "https://www.fanatic.com/en/products/fanatic-isup-fly-1.html", "Fanatic", {
      titleCutAfter: ["ᐅ"],
    })[0];
    expect(p?.modelName).toBe("FLY AIR");
  });
});

describe("kép-URL entitás-dekódolás", () => {
  /**
   * Élesben (fanatic.com) a `src`-ben a query-elválasztó `&amp;` alakban áll.
   * Enélkül a paraméter neve `amp;height` lett, és a kiszolgáló a rossz
   * méretet adta vissza — a katalógusba 4 kB-os, 50 px-es bélyegkép került.
   */
  it("a `&amp;` a kép-URL-ben valódi elválasztóvá válik", () => {
    const page = `<html><head><title>Blitz Air</title></head><body>
      <p>Length: 340 cm Width: 81 cm Thickness: 15 cm</p>
      <img src="https://x.com/files/original/Blitz_Air.png?width=50&amp;height=50">
      </body></html>`;
    const p = extractProductFromPage(page, "https://www.fanatic.com/en/products/z-1.html", "Fanatic");
    expect(p?.imageUrl).not.toContain("amp;");
    expect(p?.imageUrl).toContain("width=768");
  });
});
