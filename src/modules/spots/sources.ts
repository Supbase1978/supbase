/**
 * Vízi forrás-nyilvántartás — minden vízre és spotra vonatkozó állításunk
 * ELSŐDLEGES forrása (jogszabály, hatóság, nemzeti park, önkormányzat,
 * üzemeltető). Két fogyasztója van:
 *
 *   1. a UI: a spot- és az `/alapinfo`-oldal „Források" blokkja, hogy a
 *      felhasználó maga is ellenőrizhesse, amit állítunk;
 *   2. a negyedéves `tools/source-check` futás (`.github/workflows/
 *      source-check.yml`): letölti a forrást, és megnézi, szerepel-e benne
 *      még MINDEN `expect` kifejezés. Ha nem, GitHub issue-t nyit.
 *
 * Az `expect` tehát NEM dísz: annak a mondatnak a szó szerinti darabja,
 * amire az állításunk épül. Ha a forrás átfogalmazza, a riasztás jogos —
 * ember nézi meg, hogy a szabály változott-e, vagy csak a szöveg.
 * (Összehasonlítás normalizálva: kis/nagybetű, kötőjel- és idézőjel-
 * változatok, szóközök nem számítanak — ld. `tools/source-check/check.ts`.)
 *
 * A fájl importmentes (a `WaterInfoSlug` csak típus): a Node a CLI-ből
 * típus-lehántással közvetlenül futtatja.
 *
 * Források és a kutatás menete: `docs/VIZTESTEK_KUTATAS.md`.
 */

import type { WaterInfoSlug } from "./waterinfo";

export interface WaterSource {
  /** Amit a felhasználó megnyit (hivatalos oldal, ha van). */
  url: string;
  /**
   * Amit a checker letölt, ha eltér az `url`-től. Élesben mért eset: az
   * njt.hu a Hajózási Szabályzatnak csak az ELEJÉT adja ki böngésző nélkül,
   * a teljes szöveg a net.jogtar.hu-n olvasható.
   */
  checkUrl?: string;
  title: { hu: string; en: string };
  /** Szó szerinti szövegdarabok, amelyekre az állításunk épül. */
  expect: readonly string[];
  /** Mikor olvastuk el utoljára ember-szemmel (ISO dátum). */
  reviewedAt: string;
}

export const SOURCES = {
  // --- Jogszabályok --------------------------------------------------------
  vkt: {
    url: "https://njt.hu/jogszabaly/2000-42-00-00",
    title: {
      hu: "2000. évi XLII. törvény a víziközlekedésről (Nemzeti Jogszabálytár)",
      en: "Act XLII of 2000 on water transport (National Legislation Database)",
    },
    expect: [
      "vízi sporteszköz: vízen való közlekedésre alkalmas, rendeltetésszerű használata esetén úszóképes és kormányozható",
    ],
    reviewedAt: "2026-09-26",
  },
  hsz: {
    url: "https://njt.hu/jogszabaly/2011-57-20-2W",
    checkUrl: "https://net.jogtar.hu/jogszabaly?docid=a1100057.nfm",
    title: {
      hu: "57/2011. (XI. 22.) NFM rendelet — Hajózási Szabályzat",
      en: "Decree 57/2011 (XI. 22.) NFM — Navigation Rules",
    },
    expect: [
      "emberi erővel hajtott vízi sporteszközön, ha a használó 14. életévét betöltött úszni tudó személy, legalább úszást segítő mellény vagy biztonsági bokapánt (leash) viselése kötelező",
      "az emberi erővel hajtott vízi sporteszköz a) a b) és c) alpontban foglalt kivétellel – a parttól számított legfeljebb 500 méter távolságon belül közlekedhet",
      "csak a parttól számított 100 méter távolságon belül közlekedhet",
      "9.21 cikk – vízijárművek közlekedése",
      "a tó partjától mért 200 méternél kisebb távolságban",
    ],
    reviewedAt: "2026-09-26",
  },
  bm46: {
    url: "https://njt.hu/jogszabaly/2001-46-20-0A",
    title: {
      hu: "46/2001. (XII. 27.) BM rendelet — a szabad vízen tartózkodás alapvető szabályai",
      en: "Decree 46/2001 (XII. 27.) BM — basic rules for being in open water",
    },
    expect: [
      "a velencei-tavon, a tisza-tavon és a fertő tavon minden év április elsejétől október harmincegyedikéig vihar-előrejelző és viharjelző szolgálat működik",
      "a tisza-tó területén a parttól 500 méternél nagyobb távolságra",
    ],
    reviewedAt: "2026-09-26",
  },
  kovim17: {
    url: "https://njt.hu/jogszabaly/2002-17-20-93",
    title: {
      hu: "17/2002. (III. 7.) KöViM rendelet — a víziutak jegyzéke",
      en: "Decree 17/2002 (III. 7.) KöViM — list of waterways",
    },
    expect: [
      "ráckevei-duna 58-0",
      "szentendrei-duna 32-0",
      "mosoni-duna 14-2",
      "hármas-körös 91-0",
      "velencei-tó",
      "fertő tó",
    ],
    reviewedAt: "2026-09-26",
  },
  korm30: {
    url: "https://njt.hu/jogszabaly/2003-30-20-22",
    title: {
      hu: "30/2003. (III. 18.) Korm. rendelet — környezetvédelmi víziközlekedési korlátozások",
      en: "Government Decree 30/2003 (III. 18.) — environmental restrictions on water transport",
    },
    expect: [
      "(opera-, sóskás-, ráfás-, és csupi-szigetek)",
      "továbbá motoros vízi sporteszköz használata tilos",
    ],
    reviewedAt: "2026-09-26",
  },

  // --- Hatóságok, nemzeti parkok, kezelők ----------------------------------
  policeBalaton: {
    url: "https://www.police.hu/hu/hirek-es-informaciok/bkkb/aktualis/biztonsagban-a-balatonon",
    title: {
      hu: "Rendőrség — Biztonságban a Balatonon",
      en: "Hungarian Police — Safe on Lake Balaton (in Hungarian)",
    },
    expect: ["1817"],
    reviewedAt: "2026-09-26",
  },
  fertoGyik: {
    url: "https://www.ferto-hansag.hu/hu/gyik.html",
    title: {
      hu: "Fertő–Hanság Nemzeti Park — Gyakran ismételt kérdések",
      en: "Fertő–Hanság National Park — FAQ (in Hungarian)",
    },
    expect: [
      "a táblával jelzett fokozottan védett területek kivételével egyénileg, saját kenuval is lehet közlekedni",
      "a fertő magyar oldalának közel 90%-a nádas mocsár",
      "teljes egésze védett terület, részben fokozottan védett",
      "nyílt vízi megközelítési pontjai a fertő tavi fejlesztés területe (fertőrákosi-öböl, északi-kikötő), a virágos-majori kikötő és csatorna, illetve a soproni-csatorna",
    ],
    reviewedAt: "2026-09-26",
  },
  rdhsz2026: {
    url: "https://www.rdhsz.hu/index.php/hirek/17-informaciok/szabalyok/1216-horgaszrend-2026",
    title: {
      hu: "Ráckevei Dunaági Horgász Szövetség — az RSD 2026. évi horgászrendje",
      en: "Ráckeve Danube Arm Angling Association — 2026 angling rules (in Hungarian)",
    },
    expect: [
      "táblákkal és bójákkal kijelölt védőterületen belül tilos a horgászat és a vízi járművel való közlekedés",
    ],
    reviewedAt: "2026-09-26",
  },
  kheszHorgaszrend: {
    url: "https://www.khesz.hu/a-khesz-kezeleseben-levo-vizteruletek-helyi-horgaszrendje-2012-egyseges-szerkezetben/",
    title: {
      hu: "Körösvidéki Horgász Egyesületek Szövetsége — helyi horgászrend (Körös-Maros NP előírásaival)",
      en: "Körös Region Angling Associations — local rules incl. Körös-Maros NP provisions (in Hungarian)",
    },
    expect: [
      "robbanómotoros csónakkal csak az élővízen szabad közlekedni",
      "holtágakon és kubikokon",
    ],
    reviewedAt: "2026-09-26",
  },
  kovizigZsilip: {
    url: "https://www.kovizig.hu/koros-videki/vizgazdalkodas-vizszolgaltatas/duzzasztok-uzemelese/duzzasztok-uzemelese",
    title: {
      hu: "Körös-vidéki Vízügyi Igazgatóság — a duzzasztók és a békésszentandrási hajózsilip üzemelése",
      en: "Körös Region Water Directorate — weir and Békésszentandrás lock operation (in Hungarian)",
    },
    expect: [
      "egyedül érkező kishajók, csónakok számára 8:00-9:00 és 16:00-18:00 óra közötti időszakban van lehetőség",
      "március 1. és november 30. között 8:00-18:00 óra közötti időszakban folyamatosan",
    ],
    reviewedAt: "2026-09-26",
  },
  helloSzigetkoz: {
    url: "https://helloszigetkoz.hu/hello-szigetkoz-engedelyek/",
    title: {
      hu: "HelloSzigetköz — engedélyek",
      en: "HelloSzigetköz — permits (in Hungarian)",
    },
    expect: ["engedélyt kell kérni a hatóságtól"],
    reviewedAt: "2026-09-26",
  },
  orfuVizisport: {
    url: "https://orfu.hu/csepptol/vizi-sportok/",
    title: { hu: "Orfű — Vízi sportok", en: "Orfű — Water sports (in Hungarian)" },
    expect: ["kajak, kenu, sup bérlés"],
    reviewedAt: "2026-09-26",
  },
  orfuHorgaszrend: {
    url: "http://orfuhe.hu/udvozuljuk-az-orfui-horgaszegyesulet-honlapjan/horgaszrend/",
    title: {
      hu: "Orfűi Horgászegyesület — horgászrend (Orfűi-tó)",
      en: "Orfű Angling Association — angling rules for Lake Orfű (in Hungarian)",
    },
    expect: ["a tavon mindennemű vízi jármű elhelyezése és az abból való horgászat tilos"],
    reviewedAt: "2026-09-26",
  },
  supbazis: {
    url: "https://supbazis.hu/sup-biztonsag/",
    title: {
      hu: "SUP Bázis, Tisza-tó — SUP biztonság",
      en: "SUP Bázis, Lake Tisza — SUP safety (in Hungarian)",
    },
    expect: ['mindig viselj "leash"-t'],
    reviewedAt: "2026-09-26",
  },
  eveznijo: {
    url: "https://eveznijo.hu/",
    title: { hu: "Evezni jó — vízállás-előrejelzés", en: "Evezni jó — water level forecast (in Hungarian)" },
    expect: ["vízállás"],
    reviewedAt: "2026-09-26",
  },

  // --- Spot-szintű (üzemeltető, önkormányzat) ------------------------------
  oregtoSzabalyok: {
    url: "https://oregtotata.hu/index.php/szabalyok-a-vizen",
    title: { hu: "Tatai Öreg-tó — Szabályok a vízen", en: "Tata Old Lake — Rules on the water (in Hungarian)" },
    expect: ["sporteszközök (jelzés nélkül, kifejezetten sport céllal): - sup"],
    reviewedAt: "2026-09-26",
  },
  lupaBeach: {
    // A 2026-08-31-én rögzített SUP-szabályzat (saját SUP-jegy, nyilatkozat,
    // mentőmellény) 2026-09-26-án már NEM volt az üzemeltetői oldalon —
    // valószínűleg szezonális aloldal volt. Amit ma igazolni tudunk: ez.
    url: "https://lupabeach.com/gyik/",
    title: { hu: "Lupa Beach — Gyakori kérdések", en: "Lupa Beach — FAQ (in Hungarian)" },
    expect: ["a vizes sportbázison vitorlázás, sup"],
    reviewedAt: "2026-09-26",
  },
  kaposvarDeseda: {
    url: "https://egeszseges.kaposvar.hu/cikk/deseda",
    title: {
      hu: "Kaposvár Megyei Jogú Város — Deseda (Egészséges Kaposvár 2030)",
      en: "City of Kaposvár — Deseda (in Hungarian)",
    },
    expect: ["a kaposvári vízügyi sc-nél különféle sporteszközöket is bérelhetünk"],
    reviewedAt: "2026-09-26",
  },
  desedaTo: {
    url: "https://www.deseda.hu/a-to-bemutatasa",
    title: { hu: "Deseda — a tó bemutatása", en: "Deseda — about the lake (in Hungarian)" },
    expect: ["kaposvári sporthorgász egyesület"],
    reviewedAt: "2026-09-26",
  },
  szelidiProgramok: {
    url: "https://www.szelidi-to.hu/programok_hun.html",
    title: { hu: "Szelidi-tó — Programok", en: "Lake Szelid — Activities (in Hungarian)" },
    expect: ["kajak, kenu, csónak, ladik, surf, vízibicikli bérlésére nyílik lehetőség"],
    reviewedAt: "2026-09-26",
  },
  knpSzelid: {
    url: "https://www.knp.hu/hu/szelidi-to",
    title: { hu: "Kiskunsági Nemzeti Park — Szelidi-tó", en: "Kiskunság National Park — Lake Szelid (in Hungarian)" },
    expect: ["2/1976. otvh", "360 ha"],
    reviewedAt: "2026-09-26",
  },
  dunapatajHorgaszrend: {
    url: "https://dunapatajishe.hu/altalanos-szabalyok/",
    title: {
      hu: "Dunapataji Horgászegyesület — általános szabályok a Szelidi-tavon",
      en: "Dunapataj Angling Association — general rules on Lake Szelid (in Hungarian)",
    },
    expect: [
      "robbanómotoros vízi jármű csak szolgálati célból használható, elektromos csónakmotor használata engedélyezett",
      "a nádfalba bemenni",
    ],
    reviewedAt: "2026-09-26",
  },
  toserdo: {
    url: "https://toserdo.hu/",
    title: { hu: "Tőserdő — Lakitelek", en: "Tőserdő — Lakitelek (in Hungarian)" },
    expect: ["a sup (stand up paddle) nem csupán egy trendi vízisport"],
    reviewedAt: "2026-09-26",
  },
  toserdoKolcsonzo: {
    url: "https://www.toserdo.hu/szolgaltatasaink/csonakkolcsonzo",
    title: { hu: "Tőserdő — Csónakkölcsönző", en: "Tőserdő — Boat rental (in Hungarian)" },
    expect: ["vezetett vízitúrát igény szerint"],
    reviewedAt: "2026-09-26",
  },
  bankStrand: {
    url: "https://bank-falu.hu/bank/strand",
    title: { hu: "Bánk Község — Bánki Tó-Strand", en: "Bánk village — Lake Bánk beach (in Hungarian)" },
    expect: ["sup kölcsönzés", "lomen jános sétány"],
    reviewedAt: "2026-09-26",
  },
  bankSupSzabalyzat: {
    url: "https://bank-falu.hu/bank/docs/sup_hasznalat_szabalyai.pdf",
    title: {
      hu: "Bánk Község — Állószörf (SUP) bérlésének és használatának szabályai (PDF)",
      en: "Bánk village — SUP rental and usage rules (PDF, in Hungarian)",
    },
    expect: [
      "a sup-ot kizárólag a bóják által határolt, fürdőzésre, illetve úszásra kijelölt területen kívül lehet használni",
      "a sup használata során mentőmellény viselése kötelező",
    ],
    reviewedAt: "2026-09-26",
  },

  // --- Csak a kutatási jegyzethez (nincs spot/víz), de a checker figyeli ---
  gyomroTofurdo: {
    url: "http://gyomroitofurdo.hu/",
    title: { hu: "Gyömrői Tófürdő", en: "Gyömrő Lake Bath (in Hungarian)" },
    expect: ["a tófürdőn a sup használata nem lehetséges"],
    reviewedAt: "2026-09-26",
  },
} as const satisfies Record<string, WaterSource>;

export type SourceId = keyof typeof SOURCES;

/** Az `/alapinfo/:viz` oldalak forrásai (a spot-oldal is ezeket örökli). */
export const WATER_SOURCES: Record<WaterInfoSlug, readonly SourceId[]> = {
  balaton: ["hsz", "vkt", "bm46", "kovim17", "policeBalaton"],
  "velencei-to": ["hsz", "vkt", "bm46", "kovim17"],
  "tisza-to": ["hsz", "bm46", "supbazis"],
  "ferto-to": ["fertoGyik", "hsz", "bm46", "kovim17"],
  duna: ["hsz", "vkt", "kovim17"],
  rsd: ["kovim17", "korm30", "rdhsz2026", "hsz"],
  tisza: ["kovim17", "hsz", "eveznijo"],
  "harmas-koros": ["kovim17", "hsz", "kheszHorgaszrend", "kovizigZsilip"],
  szigetkoz: ["helloSzigetkoz", "kovim17", "hsz"],
  orfu: ["orfuVizisport", "orfuHorgaszrend"],
};

/**
 * Spot-szintű (a víz forrásain FELÜLI) források, a spot fix UUID-ja szerint.
 * Ahol nincs sor, ott a spot saját leírásának nincs külön elsődleges forrása
 * — a korai (F1-seed) spotoknál ez nyitott tétel, ld. a kutatási jegyzetet.
 */
export const SPOT_SOURCES: Readonly<Record<string, readonly SourceId[]>> = {
  "d0000016-0000-0000-0000-000000000000": ["rdhsz2026", "korm30"], // Ráckeve
  "d0000017-0000-0000-0000-000000000000": ["kovizigZsilip", "kheszHorgaszrend"], // Gyomaendrőd
  "d0000022-0000-0000-0000-000000000000": ["kovim17"], // Szentendre
  "d0000023-0000-0000-0000-000000000000": ["oregtoSzabalyok"], // Tatai Öreg-tó
  "d0000024-0000-0000-0000-000000000000": ["lupaBeach"], // Lupa-tó
  "d0000025-0000-0000-0000-000000000000": ["kaposvarDeseda", "desedaTo"], // Deseda
  "d0000026-0000-0000-0000-000000000000": ["szelidiProgramok", "knpSzelid", "dunapatajHorgaszrend"],
  "d0000027-0000-0000-0000-000000000000": ["toserdo", "toserdoKolcsonzo"], // Tőserdő
  "d0000028-0000-0000-0000-000000000000": ["bankStrand", "bankSupSzabalyzat"], // Bánki-tó
};

/** Egy spot összes forrása: a sajátjai elöl, utána a vízé — ismétlés nélkül. */
export function sourceIdsForSpot(
  spotId: string,
  waterInfoSlug: WaterInfoSlug | null,
): SourceId[] {
  const own = SPOT_SOURCES[spotId] ?? [];
  const water = waterInfoSlug ? WATER_SOURCES[waterInfoSlug] : [];
  return [...new Set([...own, ...water])];
}

/**
 * A „Források" blokk elemei a kért nyelven. A dátum-feliratot a hívó adja
 * (a route-réteg i18n-je), hogy itt ne legyen UI-szöveg.
 */
export function sourceListItems(
  ids: readonly SourceId[],
  locale: "hu" | "en",
  reviewedLabel: (isoDate: string) => string,
): { id: SourceId; url: string; title: string; reviewed: string }[] {
  return ids.map((id) => {
    const source: WaterSource = SOURCES[id];
    return {
      id,
      url: source.url,
      title: source.title[locale],
      reviewed: reviewedLabel(source.reviewedAt),
    };
  });
}
