/**
 * Őrszem-teszt: a fejléc és a lap-tartalom AZONOS max-szélességen fusson.
 *
 * A hiba, ami ezt kiváltotta: a nav `max-w-5xl` volt, a lapok fele viszont
 * `max-w-3xl` (egy `max-w-2xl`). Mivel mindkettő `mx-auto`-val középre igazít,
 * a különböző szélességek KÜLÖNBÖZŐ bal szélt adtak — a tartalom láthatóan
 * elcsúszott a menühöz képest (768 vs. 1024 px → 128 px eltérés). Ez a fajta
 * elcsúszás vizuális teszt nélkül könnyen visszaszivárog egy új route-tal.
 *
 * Az auth-űrlapok (`max-w-md` + `justify-center`) SZÁNDÉKOSAN kivételek: a
 * középre igazított, keskeny „kártya" bevett minta, nem olvasódik hibának.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PAGE_MAX_WIDTH } from "@core/ui/layout";

const ROUTES_DIR = join(process.cwd(), "app", "routes");

/** Középre igazított, szélesség-korlátos konténer első előfordulása. */
const CONTAINER_RE = /mx-auto[^"'`]*?(max-w-[0-9a-z]+)/;

/** Szándékos kivételek: keskeny, középre igazított auth-kártyák. */
const NARROW_CARD_ROUTES = new Set([
  "belepes.tsx",
  "regisztracio.tsx",
  "beleegyezes.tsx",
  "elfelejtett-jelszo.tsx",
  "uj-jelszo.tsx",
]);

function routeFiles(): string[] {
  return readdirSync(ROUTES_DIR).filter(
    (name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"),
  );
}

describe("lap-szélesség egységessége", () => {
  it("a fejléc a kanonikus szélességet használja", () => {
    const nav = readFileSync(join(process.cwd(), "app", "nav.tsx"), "utf8");
    expect(nav).toContain(PAGE_MAX_WIDTH);
  });

  it.each(routeFiles().filter((f) => !NARROW_CARD_ROUTES.has(f)))(
    "%s tartalom-konténere a fejléccel egyező szélességű",
    (file) => {
      const source = readFileSync(join(ROUTES_DIR, file), "utf8");
      const match = CONTAINER_RE.exec(source);
      // Nincs saját konténer (pl. resource route vagy külön komponens rendereli)
      // → nincs mit ellenőrizni.
      if (!match) return;
      expect(match[1], `${file}: eltérő lap-szélesség`).toBe(PAGE_MAX_WIDTH);
    },
  );

  it("a keskeny auth-kártyák szándékos kivételek maradnak", () => {
    for (const file of NARROW_CARD_ROUTES) {
      const source = readFileSync(join(ROUTES_DIR, file), "utf8");
      expect(CONTAINER_RE.exec(source)?.[1], `${file}`).toBe("max-w-md");
    }
  });
});
