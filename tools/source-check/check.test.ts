import { describe, expect, it } from "vitest";

import { SOURCES, SPOT_SOURCES, WATER_SOURCES, sourceIdsForSpot } from "../../src/modules/spots/sources.ts";
import { WATER_INFO_SLUGS } from "../../src/modules/spots/waterinfo.ts";
import {
  decodeBody,
  decodeEntities,
  detectCharset,
  findMissing,
  htmlToPlain,
  isPdf,
  normalizeText,
} from "./check.ts";

describe("normalizeText", () => {
  it("a kötőjel- és gondolatjel-változatokat egyformának veszi (njt.hu: „58–0”)", () => {
    expect(normalizeText("Ráckevei-Duna 58–0")).toBe(normalizeText("ráckevei-duna 58-0"));
  });

  it("a tipográfiai és az egyenes idézőjelet egyformának veszi", () => {
    expect(normalizeText("„leash”-t")).toBe(normalizeText('"leash"-t'));
  });

  it("a latin-1 kori õ/û pótlást ő/ű-nek olvassa (szelidi-to.hu)", () => {
    expect(normalizeText("lehetõség, mûködik")).toBe("lehetőség, működik");
  });

  it("a nem törhető szóközt és a sortörést egy szóközre vonja össze", () => {
    expect(normalizeText("500 méter\n  távolságon")).toBe("500 méter távolságon");
  });
});

describe("decodeEntities / htmlToPlain", () => {
  it("feloldja a magyar ékezetes névvel ellátott entitásokat (toserdo.hu)", () => {
    expect(decodeEntities("v&iacute;zit&uacute;r&aacute;t, k&ouml;lcs&ouml;nz&odblac;")).toBe(
      "vízitúrát, kölcsönző",
    );
  });

  it("a numerikus entitásokat is feloldja", () => {
    expect(decodeEntities("&#337;&#x171;")).toBe("őű");
  });

  it("a szkriptet és a stílust kidobja, a tageket szóközre cseréli", () => {
    const plain = htmlToPlain("<style>p{}</style><p>SUP<br/>bérlés</p><script>var x='SUP tilos';</script>");
    expect(normalizeText(plain)).toBe("sup bérlés");
  });
});

describe("decodeBody", () => {
  it("a fejlécbeli iso-8859-2 charsetet követi (bank-falu.hu)", () => {
    // „Petőfi" ISO-8859-2-ben: az ő = 0xF5
    const bytes = new Uint8Array([0x50, 0x65, 0x74, 0xf5, 0x66, 0x69]);
    expect(decodeBody(bytes, "text/html;charset=iso-8859-2")).toBe("Petőfi");
  });

  it("fejléc híján a meta charsetet olvassa", () => {
    expect(detectCharset(null, '<meta charset="windows-1250">')).toBe("windows-1250");
  });

  it("felismeri a PDF-et a varázsbájtokról, ha a content-type hiányzik", () => {
    expect(isPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), null)).toBe(true);
    expect(isPdf(new Uint8Array([0x3c, 0x68]), "text/html")).toBe(false);
  });
});

describe("findMissing", () => {
  it("csak a hiányzó kifejezéseket adja vissza", () => {
    const text = "A tavon mindennemű vízi jármű elhelyezése és az abból való horgászat tilos!";
    expect(findMissing(text, ["mindennemű vízi jármű", "sup bérlés"])).toEqual(["sup bérlés"]);
  });
});

describe("forrás-nyilvántartás", () => {
  it("minden víz- és spot-hivatkozás létező forrásra mutat", () => {
    const ids = new Set(Object.keys(SOURCES));
    for (const list of [...Object.values(WATER_SOURCES), ...Object.values(SPOT_SOURCES)]) {
      for (const id of list) expect(ids.has(id)).toBe(true);
    }
  });

  it("minden `/alapinfo` vízhez van legalább egy forrás", () => {
    for (const slug of WATER_INFO_SLUGS) expect(WATER_SOURCES[slug].length).toBeGreaterThan(0);
  });

  it("minden forrásnak van ellenőrizhető kifejezése, https/http URL-je és hu+en címe", () => {
    for (const source of Object.values(SOURCES)) {
      expect(source.expect.length).toBeGreaterThan(0);
      expect(source.url).toMatch(/^https?:\/\//);
      expect(source.title.hu.length).toBeGreaterThan(0);
      expect(source.title.en.length).toBeGreaterThan(0);
      expect(source.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("a spot forrásai: a saját elöl, a vízéi utána, ismétlés nélkül", () => {
    const ids = sourceIdsForSpot("d0000016-0000-0000-0000-000000000000", "rsd");
    expect(ids.slice(0, 2)).toEqual(["rdhsz2026", "korm30"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
