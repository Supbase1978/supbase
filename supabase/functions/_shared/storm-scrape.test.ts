/**
 * BM OKF viharjelzés-parse — fixture-HTML-lel, hálózat nélkül (9./1.).
 * Három állapot: nincs jelzés / I. fok egy körzetben / II. fok egy körzetben;
 * plusz a szintváltás-detektálás táblázatos esetei (0→1, 1→2, 2→0, nincs változás).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  detectImageLevel,
  detectLevel,
  detectPageLevel,
  detectStormLevelChanges,
  parseStormWarnings,
  stripHtml,
  type DetectedLevel,
  type StormLevelChange,
} from "./storm-scrape.ts";
import type { StormLevel } from "./types.ts";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

describe("detectLevel — pozitív fokozat / leminősítés", () => {
  const cases: [string, DetectedLevel][] = [
    ["nincs viharjelzés", 0],
    ["viharjelzés megszűnt", 0],
    ["i. fokú viharjelzés (előkészítő jelzés)", 1],
    ["elsőfokú előkészítő jelzés", 1],
    ["ii. fokú viharjelzés (vészjelzés)", 2],
    ["másodfokú vészjelzés", 2],
    // A "ii. fok" NEM olvasható félre "i. fok"-ként (II. előbb ellenőrizve):
    ["ii.fok", 2],
    ["i.fok", 1],
  ];
  it.each(cases)("%s → %s", (text, expected) => {
    expect(detectLevel(text)).toBe(expected);
  });
});

describe("detectLevel — M1: tagadás-tudatosság + unknown", () => {
  it("tagadott II. fok ('nincs másodfokú...') NEM ad 2-t (hamis pozitív ellen)", () => {
    expect(detectLevel("nincs másodfokú viharjelzés érvényben")).not.toBe(2);
  });

  it("tagadott II. fok pozitív 'nincs jelzés' nélkül → unknown (nem 0!)", () => {
    // Nincs kontiguus 'nincs viharjelzés' minta → nem minősíthető le hamisan.
    expect(detectLevel("nincs másodfokú viharjelzés érvényben")).toBe("unknown");
  });

  it("körzet-needle fokozat NÉLKÜL (menü/footer-link) → unknown", () => {
    expect(detectLevel("balaton régió térkép nyomtatás kapcsolat")).toBe("unknown");
  });

  it("tagadott I. fok ('nem elsőfokú') → unknown", () => {
    expect(detectLevel("jelenleg nem elsőfokú a helyzet")).toBe("unknown");
  });

  it("'nincs elsőfokú, de másodfokú van érvényben' → 2 (a II. fok nincs tagadva)", () => {
    expect(detectLevel("nincs elsőfokú, de másodfokú van érvényben")).toBe(2);
  });
});

describe("stripHtml", () => {
  it("tageket, script/style-t eltávolít, kisbetűsít", () => {
    const out = stripHtml("<div>Balaton <script>x()</script> <b>I. FOK</b></div>");
    expect(out).toBe("balaton i. fok");
  });
});

describe("parseStormWarnings — fixture-állapotok", () => {
  it("nincs jelzés: minden körzet 0", () => {
    const map = parseStormWarnings(fixture("storm.none.html"));
    expect(map.get("Balaton")).toBe(0);
    expect(map.get("Velencei-tó")).toBe(0);
    expect(map.get("Tisza-tó")).toBe(0);
    expect(map.get("Fertő")).toBe(0);
  });

  it("I. fok a Balatonon, a többi 0", () => {
    const map = parseStormWarnings(fixture("storm.level1-balaton.html"));
    expect(map.get("Balaton")).toBe(1);
    expect(map.get("Velencei-tó")).toBe(0);
    expect(map.get("Tisza-tó")).toBe(0);
    expect(map.get("Fertő")).toBe(0);
  });

  it("II. fok a Velencei-tavon (a szomszéd sor nem szennyezi be a Balatont)", () => {
    const map = parseStormWarnings(fixture("storm.level2-velence.html"));
    expect(map.get("Balaton")).toBe(1);
    expect(map.get("Velencei-tó")).toBe(2);
    expect(map.get("Tisza-tó")).toBe(0);
    expect(map.get("Fertő")).toBe(0);
  });

  it("hiányzó körzet nem kerül a Map-be", () => {
    const map = parseStormWarnings("<p>Balaton: nincs viharjelzés</p>");
    expect(map.has("Balaton")).toBe(true);
    expect(map.has("Fertő")).toBe(false);
  });
});

describe("M1 — leminősítés csak pozitív megerősítésre (parse + change)", () => {
  it("needle fokozat NÉLKÜL → a körzet kimarad a Map-ből (nincs 2→0 leminősítés)", () => {
    // A Velencei-tó csak menü-linkként szerepel, fokozat-szöveg nélkül.
    const map = parseStormWarnings(
      "<nav><a href='/velencei-to'>Velencei-tó</a></nav><p>Balaton: nincs viharjelzés</p>",
    );
    expect(map.has("Velencei-tó")).toBe(false);
    expect(map.get("Balaton")).toBe(0);

    // Egy érvényben lévő II. fok NEM minősül le hamisan: a change kimarad.
    const prev = new Map<string, StormLevel>([["Velencei-tó", 2]]);
    expect(detectStormLevelChanges(prev, map)).toEqual([]);
  });

  it("pozitív 'nincs jelzés' → valós leminősítés 2→0 és 1→0", () => {
    const map = parseStormWarnings(fixture("storm.none.html"));
    const prev = new Map<string, StormLevel>([
      ["Velencei-tó", 2],
      ["Balaton", 1],
    ]);
    expect(detectStormLevelChanges(prev, map)).toEqual<StormLevelChange[]>([
      { region: "Balaton", from: 1, to: 0 },
      { region: "Velencei-tó", from: 2, to: 0 },
    ]);
  });
});

describe("detectStormLevelChanges", () => {
  const prev = new Map<string, StormLevel>([
    ["Balaton", 0],
    ["Velencei-tó", 1],
    ["Tisza-tó", 2],
    ["Fertő", 0],
  ]);

  it("0→1, 1→2, 2→0 detektálva; a változatlan (Fertő 0→0) kimarad", () => {
    const cur = new Map<string, StormLevel>([
      ["Balaton", 1], // 0→1
      ["Velencei-tó", 2], // 1→2
      ["Tisza-tó", 0], // 2→0
      ["Fertő", 0], // változatlan
    ]);
    const changes = detectStormLevelChanges(prev, cur);
    expect(changes).toEqual<StormLevelChange[]>([
      { region: "Balaton", from: 0, to: 1 },
      { region: "Velencei-tó", from: 1, to: 2 },
      { region: "Tisza-tó", from: 2, to: 0 },
    ]);
  });

  it("nincs változás → üres lista", () => {
    expect(detectStormLevelChanges(prev, new Map(prev))).toEqual([]);
  });

  it("hiányzó előző szint 0-nak számít (első futás)", () => {
    const changes = detectStormLevelChanges(
      new Map(),
      new Map<string, StormLevel>([["Balaton", 2]]),
    );
    expect(changes).toEqual<StormLevelChange[]>([
      { region: "Balaton", from: 0, to: 2 },
    ]);
  });

  it("a current-ből kimaradt körzetet nem érinti (nem ír felül)", () => {
    const changes = detectStormLevelChanges(
      prev,
      new Map<string, StormLevel>([["Balaton", 1]]),
    );
    expect(changes).toEqual<StormLevelChange[]>([
      { region: "Balaton", from: 0, to: 1 },
    ]);
  });
});

describe("detectImageLevel — viharjelzesN.png másodlagos jel", () => {
  it("valódi 0-s oldal: viharjelzes0.png → 0", () => {
    expect(detectImageLevel(fixture("methu.tisza-to.html"))).toBe(0);
  });

  it("több medence-ikon → a legmagasabb számít", () => {
    expect(detectImageLevel(fixture("methu.balaton.mixed12.html"))).toBe(2);
  });

  it("kép nélkül → unknown", () => {
    expect(detectImageLevel("<p>szöveg kép nélkül</p>")).toBe("unknown");
  });
});

describe("detectPageLevel — met.hu tavankénti main.php", () => {
  it("valódi 0-s letöltések („a viharjelző rendszer alapon van”) → 0", () => {
    expect(detectPageLevel(fixture("methu.balaton.html"))).toBe(0);
    expect(detectPageLevel(fixture("methu.velencei-to.html"))).toBe(0);
    expect(detectPageLevel(fixture("methu.tisza-to.html"))).toBe(0);
  });

  it("I. fokú oldal (élőben megfigyelt formátum) → 1", () => {
    expect(detectPageLevel(fixture("methu.balaton.level1.html"))).toBe(1);
  });

  it("II. fokú oldal → 2", () => {
    expect(detectPageLevel(fixture("methu.velencei-to.level2.html"))).toBe(2);
  });

  it("vegyes medence-fokozat (II+I+I) → körzet-szinten a maximum: 2", () => {
    expect(detectPageLevel(fixture("methu.balaton.mixed12.html"))).toBe(2);
  });

  it("szöveg–kép eltérésnél a magasabb győz (fail-safe felfelé)", () => {
    const html =
      "<img src='/images/elemek/viharjelzes2.png'>" +
      "<p>A tavon elsőfokú viharjelzés érvényes.</p>";
    expect(detectPageLevel(html)).toBe(2);
  });

  it("se szöveg-, se kép-jel → unknown (nincs hamis leminősítés)", () => {
    expect(detectPageLevel("<nav>Balaton | menü | lábléc</nav>")).toBe("unknown");
  });

  it("tagadott fokozat önmagában nem jelzés: „nincs másodfokú…” → unknown", () => {
    expect(detectPageLevel("<p>ma nincs másodfokú viharjelzés kilátásban</p>")).toBe(
      "unknown",
    );
  });
});
