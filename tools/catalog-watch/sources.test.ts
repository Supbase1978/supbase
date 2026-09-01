/**
 * GYÁRTÓNKÉNTI REGRESSZIÓ-HÁLÓ (F2.1-utó-36).
 *
 * Ez a teszt arra a kérdésre válaszol, amit eddig KÉZZEL kellett: „a mostani
 * javítás nem rontott-e el egy másik gyártót?" Egyetlen napon 20 commit nyúlt
 * a kinyerő szabályaihoz, és minden egyes után újra kellett nézni öt-hat
 * forrást. Innentől ezt a háló mondja meg — hálózat nélkül, másodpercek alatt.
 *
 * A háló azt a KÖZÖS belépőt futtatja (`extractPageProducts`), amit az éles
 * crawl is. Nem utánzat: ha a crawl útja megváltozik, ez is vele változik.
 */
import { describe, expect, it } from "vitest";

import { extractPageProducts, withSeriesText } from "./crawl.ts";
import { htmlToText } from "./html.ts";
import { loadFixtures } from "./fixtures/fixtures.ts";
import { SOURCE_RECIPES } from "./sources/index.ts";
import { planSourceSync, type ExistingSource } from "./sources/plan.ts";

const fixtures = loadFixtures();

describe("gyártói receptek", () => {
  it("minden recept neve egyedi", () => {
    const names = SOURCE_RECIPES.map((recipe) => recipe.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("minden recept indoklást visel a notes mezőben", () => {
    // A `notes` a moderátornak szól az admin felületén: mit tud és mit NEM
    // tud a forrás. Enélkül a beállítás megint magyarázat nélküli marad.
    for (const recipe of SOURCE_RECIPES) {
      expect(recipe.crawlConfig.notes, recipe.name).toBeTruthy();
    }
  });

  it("a base_url abszolút URL", () => {
    for (const recipe of SOURCE_RECIPES) {
      expect(() => new URL(recipe.baseUrl), recipe.name).not.toThrow();
    }
  });
});

describe("sync-sources terv", () => {
  const asRow = (index: number): ExistingSource => {
    const recipe = SOURCE_RECIPES[index]!;
    return {
      id: `id-${index}`,
      name: recipe.name,
      base_url: recipe.baseUrl,
      kind: recipe.kind,
      country: recipe.country,
      crawl_config: JSON.parse(JSON.stringify(recipe.crawlConfig)) as unknown,
    };
  };

  it("azonos állapotra nem ír semmit", () => {
    const rows = SOURCE_RECIPES.map((_, index) => asRow(index));
    const actions = planSourceSync(SOURCE_RECIPES, rows);
    expect(actions.every((action) => action.kind === "unchanged")).toBe(true);
  });

  it("hiányzó sort létrehozandónak jelöl", () => {
    const actions = planSourceSync(SOURCE_RECIPES, []);
    expect(actions.every((action) => action.kind === "create")).toBe(true);
  });

  it("az eltérő mezőt NÉVVEL jelenti", () => {
    const rows = SOURCE_RECIPES.map((_, index) => asRow(index));
    rows[0] = { ...rows[0]!, base_url: "https://mas.example" };
    const actions = planSourceSync(SOURCE_RECIPES, rows);
    expect(actions[0]?.kind).toBe("update");
    expect(actions[0]?.changes).toContain("base_url");
  });

  it("a recept NÉLKÜLI forráshoz nem nyúl, csak jelenti", () => {
    const rows = SOURCE_RECIPES.map((_, index) => asRow(index));
    rows.push({
      id: "kezzel-felvett",
      name: "Kézzel felvett bolt",
      base_url: "https://bolt.example",
      kind: "shop",
      country: "HU",
      crawl_config: {},
    });
    const actions = planSourceSync(SOURCE_RECIPES, rows);
    const extra = actions.find((action) => action.name === "Kézzel felvett bolt");
    expect(extra?.kind).toBe("extra");
  });

  it("a jsonb KULCSSORREND nem számít eltérésnek", () => {
    // A Postgres a jsonb kulcsait újrarendezi; ha ezt eltérésnek vennénk, a
    // szinkron minden futáskor fölöslegesen újraírná az összes forrást.
    const rows = SOURCE_RECIPES.map((_, index) => {
      const row = asRow(index);
      const config = row.crawl_config as Record<string, unknown>;
      const reversed = Object.fromEntries(Object.entries(config).reverse());
      return { ...row, crawl_config: reversed };
    });
    const actions = planSourceSync(SOURCE_RECIPES, rows);
    expect(actions.every((action) => action.kind === "unchanged")).toBe(true);
  });
});

describe("mentett gyártói oldalak", () => {
  it("van fixtúra", () => {
    // Ha ez elbukik, a háló ÜRES — és minden alatta lévő teszt hamis
    // biztonságot adna azzal, hogy zölden fut.
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    describe(fixture.id, () => {
      const recipe = SOURCE_RECIPES.find((item) => item.name === fixture.source);

      it("van hozzá recept", () => {
        expect(recipe, `nincs recept: ${fixture.source}`).toBeDefined();
      });

      it(`ugyanazt nyeri ki (${fixture.teaches})`, () => {
        // A SOROZAT-LEÍRÁS a hálóban is a termékoldal szövege UTÁN áll —
        // pontosan úgy, ahogy a `crawlSource` teszi. E nélkül a ROC fixtúrája
        // a TEHERBÍRÁS NÉLKÜLI kinyerést rögzítené elvárásként, vagyis azt a
        // hiányt betonozná be, ami miatt a `seriesTextByUrl` megszületett.
        const baseText = fixture.renderedText ?? htmlToText(fixture.html);
        const products = extractPageProducts(
          fixture.html,
          fixture.url,
          recipe!.crawlConfig,
          fixture.seriesText === ""
            ? fixture.renderedText
            : withSeriesText(baseText, fixture.seriesText),
        );
        expect(products).toEqual(fixture.expected);
      });

      // A „nem közölt mező" deklaráció ELLENŐRIZHETŐ állítás a forrásról, nem
      // mentség a hiányra. Ha a gyártó egyszer közölni kezdi (és a kinyerés
      // megtalálja), ez a teszt BUKIK — és megmondja, hogy a deklarációt le
      // kell venni. Enélkül a `unpublishedFields` csendben eltakarna egy
      // valódi, javítható kinyerési hibát.
      const unpublished = recipe?.crawlConfig.unpublishedFields ?? [];
      for (const field of unpublished) {
        it(`a NEM KÖZÖLTNEK deklarált \`${field}\` tényleg hiányzik`, () => {
          const products = extractPageProducts(
            fixture.html,
            fixture.url,
            recipe!.crawlConfig,
            fixture.renderedText,
          );
          for (const product of products) {
            expect(product.specs[field], product.modelName).toBeNull();
          }
        });
      }
    });
  }
});
