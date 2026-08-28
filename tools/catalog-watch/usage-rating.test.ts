import { describe, expect, it } from "vitest";

import {
  boardTypeFromCategoryLine,
  boardTypesFromCategoryLine,
  boardTypeFromDescription,
  boardTypeFromUsage,
  findModelCode,
  findProductImage,
  parseUsageRatings,
} from "./usage-rating.ts";

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

/**
 * TERMÉKKÉP (F2.1-utó-24). A felhasználók sokszor kép alapján döntenek, a
 * JSON-LD nélküli gyártói oldalon viszont nincs `og:image` sem, és 30+ `<img>`
 * van — köztük a fejléc-logók.
 */
describe("findProductImage", () => {
  // Az `alt` NEM dísz a fixtúrában: a valós oldalakon a fejléc-logó `alt=""`-t
  // visel (díszítő), a termékfotó viszont leírást — és a pozíció-fallback
  // ezen a különbségen áll vagy bukik (ld. a `findProductImage` doc-ját).
  const page = `
    <img src="https://x.com/uploads/white_LOGO-01.png" alt="">
    <img src="https://x.com/uploads/DJI_0043-scaled.jpg" alt="Coral a vízen">
    <img src="https://x.com/uploads/AQUA-MARINA-SUP-construction-CORAL-Raspberry-2-small.png" alt="Coral construction">
    <img src="https://x.com/uploads/Coral-R-1.png" alt="Coral Raspberry">
    <img src="https://x.com/uploads/AQUA-MARINA-SUP-BLAZEBT-26BZ-Ghost-White-222x1024.png" alt="Blaze Ghost White">
  `;

  it("a cikkszámra horgonyoz, és levágja a bélyegkép-méretet", () => {
    expect(findProductImage(page, "BT-26BZ")).toBe(
      "https://x.com/uploads/AQUA-MARINA-SUP-BLAZEBT-26BZ-Ghost-White.png",
    );
  });

  it("a LOGÓT sosem választja — a fallback ágon sem", () => {
    expect(findProductImage(page, "LOGO")).not.toContain("LOGO");
  });

  it("a RÉSZLET-/technológia-képet kihagyja a fő fotó javára", () => {
    // Élesben: a Coralnál a „construction-CORAL-Raspberry" nyert volna.
    expect(findProductImage(page, "Coral")).toBe("https://x.com/uploads/Coral-R-1.png");
  });

  it("a horgonyokat SORRENDBEN próbálja (cikkszám előbb, mint név)", () => {
    expect(findProductImage(page, "BT-26BZ", "Coral")).toContain("BLAZE");
  });

  /**
   * A katalógusban a képek EGYMÁS MELLETT állnak, a véleményezőnek el kell
   * igazodnia köztük — a fehér hátterű front/back render összevethető, az
   * életkép nem. Élesben: Nuts, Race Elite, Rapid.
   */
  it("azonos horgonyra a FRONT/BACK rendert választja az életkép helyett", () => {
    const rapid = `
      <img src="https://x.com/uploads/Aqua-Marina-Product-BT-22RP-11.jpg" alt="Rapid">
      <img src="https://x.com/uploads/rapid-frontback.png" alt="Rapid front/back">
    `;
    expect(findProductImage(rapid, "rapid")).toBe("https://x.com/uploads/rapid-frontback.png");
  });

  /**
   * A fájlnév nem megbízható (a gyártó elgépeli — `revolutiobn.png` —, sőt fel
   * is cseréli két termékét), a POZÍCIÓ viszont igen: a hero-kép az első
   * nem-kizárt kép. Csak akkor szólal meg, ha egyetlen horgony sem talált.
   */
  it("horgony nélkül az oldal első nem-kizárt képét adja (pozíció-fallback)", () => {
    const revolution = `
      <img src="https://x.com/uploads/white_LOGO-01.png" alt="">
      <img src="https://x.com/uploads/revolutiobn.png" alt="Revolution">
      <img src="https://x.com/uploads/backpack.jpg" alt="Hátizsák">
    `;
    expect(findProductImage(revolution, "revolution")).toBe(
      "https://x.com/uploads/revolutiobn.png",
    );
  });

  it("a fallback a horgony UTÁN jön — a találatot nem írja felül", () => {
    // A „Coral" horgony talál; az első nem-kizárt kép (DJI-életkép) nem nyer.
    expect(findProductImage(page, "Coral")).not.toContain("DJI");
  });

  /**
   * ÉLESBEN MÉRT KÁR (zraysports.com, 2026-08-28): ott a fájlnév puszta
   * sorszám, tehát sem horgony, sem fájlnév-kizárás nem fog rajta — a
   * fallback mind a 41 deszkára a fejléc-LOGÓT adta. A logót az `alt=""`
   * árulja el (a HTML-szabvány szerint: díszítő), a „Related Products" blokk
   * képeit pedig az `alt` teljes hiánya.
   */
  it("a fallback ÁTLÉPI a díszítő (alt=\"\") és az alt NÉLKÜLI képeket", () => {
    const zray = `
      <img src="//img.x/images/3865618.png" alt="" title="">
      <img class="_middleImage" src="//img.x/images/3469216.jpg" alt="X5" title="X5">
      <img src="//img.x/images/8292285.jpg" class="w-listpic-in">
    `;
    expect(findProductImage(zray, "X RIDER XL", "X")).toBe("//img.x/images/3469216.jpg");
  });

  it("csak díszítő képekből álló oldalra null (inkább semmi, mint logó)", () => {
    const onlyDecorative = `
      <img src="//img.x/images/3865618.png" alt="">
      <img src="//img.x/images/8292285.jpg">
    `;
    expect(findProductImage(onlyDecorative, "X RIDER XL")).toBeNull();
  });

  it("kép nélküli oldalra null", () => {
    expect(findProductImage("<p>nincs kép</p>", "Coral")).toBeNull();
    expect(findProductImage('<img src="https://x.com/uploads/white_LOGO-01.png">', null)).toBeNull();
  });
});

describe("findModelCode", () => {
  it("kiolvassa a cikkszámot a spec-blokkból", () => {
    expect(findModelCode("PRODUCT\nBLAZE 10'4\"\nMODEL\nBT-26BZ\nNET WEIGHT\n9.3 kg")).toBe("BT-26BZ");
  });

  it("cikkszám nélküli szövegre null", () => {
    expect(findModelCode("Csak egy leírás, cikkszám nélkül.")).toBeNull();
  });
});

/**
 * MÉRET-VÁLASZTÁS (2026-08-20) — mobil-first alkalmazásban ez nem apróság.
 * Az eredeti szabály a szerkesztőségi EREDETIT választotta: a katalógus képei
 * átlagosan 680 kB-ot nyomtak, a legrosszabb 8,9 MB-ot.
 */
describe("findProductImage — megjelenítésre való méret", () => {
  const cascade = `<img src="https://x.com/CASCADE-2.png"
    srcset="https://x.com/CASCADE-2.png 2762w,
            https://x.com/CASCADE-2-199x300.png 199w,
            https://x.com/CASCADE-2-679x1024.png 679w,
            https://x.com/CASCADE-2-768x1159.png 768w,
            https://x.com/CASCADE-2-1357x2048.png 1357w">`;

  it("a srcset-ből a MEGJELENÍTÉSHEZ ELÉG legkisebbet veszi, nem az eredetit", () => {
    // Élesben: az eredeti 8904 kB, ez a változat 772 kB.
    expect(findProductImage(cascade, "cascade")).toBe("https://x.com/CASCADE-2-768x1159.png");
  });

  it("ha egyik változat sem elég nagy, a LEGNAGYOBB elérhetőt", () => {
    const small = `<img src="https://x.com/revolutiobn.png" alt="Revolution"
      srcset="https://x.com/revolutiobn.png 470w, https://x.com/revolutiobn-141x300.png 141w">`;
    expect(findProductImage(small, "revolution")).toBe("https://x.com/revolutiobn.png");
  });

  it("srcset HÍJÁN marad az utótag-levágás (ott a src gyakran bélyegkép)", () => {
    const plain = `<img src="https://x.com/Coral-R-1-222x1024.png">`;
    expect(findProductImage(plain, "coral")).toBe("https://x.com/Coral-R-1.png");
  });

  it("a kizárt fájlnevek a srcset-es ágon is kimaradnak", () => {
    const withLogo = `<img src="https://x.com/white_LOGO.png" srcset="https://x.com/white_LOGO.png 900w">
      <img src="https://x.com/coral.png" srcset="https://x.com/coral-800x1200.png 800w">`;
    expect(findProductImage(withLogo, "coral")).toBe("https://x.com/coral-800x1200.png");
  });
});

/**
 * AZ ALLROUND SZINONIMÁI (2026-08-21, gladiatorsup.com). A gyártók ritkán
 * írják le, hogy „all-around board" — helyette „versatile", „universal",
 * „entry-level". Enélkül egy márkán belül csak a túra-deszka kapott
 * kategóriát, a többi üresen maradt.
 */
describe("boardTypeFromDescription — a gyártó saját szavai", () => {
  it.each([
    ["The universal SUP board from the Elite series in size 11'6", "allround"],
    ["The Pro 11'6 is a versatile SUP board from the Pro series", "allround"],
    ["Origin 10'6 a versatile model from the entry-level Origin series", "allround"],
    ["The touring SUP board from the Elite series in size 12'6", "touring"],
  ])("%s → %s", (text, expected) => {
    expect(boardTypeFromDescription(text)).toBe(expected);
  });

  /**
   * A szigorú minta ITT IS áll: a kategória-szó után kötelező a főnév.
   * Enélkül egy tartozék neve („ELITE Touring Fin 9″", ami MINDEN Gladiator
   * oldal oldalsávjában ott van) besorolna egy deszkát.
   */
  it("tartozék nevéből NEM sorol be", () => {
    expect(boardTypeFromDescription("Coiled Leash ELITE Touring Fin 9″ SUP SUPER PUMP")).toBeNull();
    expect(boardTypeFromDescription("versatile bag for your board")).toBeNull();
  });

  it("ELTÉRŐ kategóriák említésénél továbbra sem tippel", () => {
    expect(boardTypeFromDescription("a versatile board and also a race board")).toBeNull();
  });
});

/**
 * A GYÁRTÓ KATEGÓRIA-FELIRATA (2026-08-21, fanatic.com). A termékfejlécben
 * áll: „ALL-AROUND / WINDSURF", „TOURING / FREERACING".
 */
describe("boardTypeFromCategoryLine — a felirat SORRENDJE dönt", () => {
  it("az ELSŐ helyen álló kategóriát veszi", () => {
    // A szokásos `guessBoardType` itt race-t adna a „FREERACING"-ből, mert a
    // saját szabály-prioritása szerint dönt — a gyártó viszont az első helyre
    // a fő felhasználást írja.
    expect(boardTypeFromCategoryLine("TOURING / FREERACING")).toBe("touring");
    expect(boardTypeFromCategoryLine("ALL-AROUND / WINDSURF")).toBe("allround");
    expect(boardTypeFromCategoryLine("RACE / FREERACE")).toBe("race");
  });

  it("ismeretlen feliratra null (nem tippel)", () => {
    expect(boardTypeFromCategoryLine("WAVE / SURF")).toBeNull();
    expect(boardTypeFromCategoryLine("")).toBeNull();
  });
});

/**
 * A gyártó KETTŐT mond — és eddig a második felét eldobtuk (F2.1-utó-41).
 * A `boardTypeFromCategoryLine` az elsőt adja (az egyértékű ág változatlan),
 * a `boardTypesFromCategoryLine` viszont MINDET, a felirat sorrendjében.
 */
describe("boardTypesFromCategoryLine — a felirat MINDEN tagja", () => {
  it("a kettős feliratból KÉT kategória lesz", () => {
    expect(boardTypesFromCategoryLine("TOURING / FREERACING")).toEqual(["touring", "race"]);
  });

  it("az ELSŐ elem ugyanaz, amit az egyértékű ág ad", () => {
    for (const line of ["TOURING / FREERACING", "ALL-AROUND / WINDSURF", "RACE / FREERACE"]) {
      expect(boardTypesFromCategoryLine(line)[0]).toBe(boardTypeFromCategoryLine(line));
    }
  });

  it("a nem a mi taxonómiánkba tartozó tag kimarad", () => {
    // A „WINDSURF" nálunk nem külön típus — a deszka attól még allround.
    expect(boardTypesFromCategoryLine("ALL-AROUND / WINDSURF")).toEqual(["allround"]);
  });

  it("ismeretlen feliratra üres (nem tippel)", () => {
    expect(boardTypesFromCategoryLine("WAVE / SURF")).toEqual([]);
  });
});

describe("findProductImage — a két nézetes render többféle néven", () => {
  /**
   * Élesben: a Fanatic Viper Air képe enélkül a `Gallery02.jpg` lett volna —
   * egy vitorlás felszerelés a vízen, nem a deszka.
   */
  it("a Top_Bottom rendert ugyanúgy előnyben részesíti, mint a front-backet", () => {
    const page = `
      <img src="https://x.com/FANATIC-SUP-2025_ViperAirSLT_Gallery02.jpg">
      <img src="https://x.com/FANATIC-SUP_2025_Viper_Air_SLT_Top_Bottom_2500x2500px.png">
    `;
    expect(findProductImage(page, "Viper Air")).toContain("Top_Bottom");
  });
});
