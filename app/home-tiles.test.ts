import { describe, expect, it } from "vitest";

import type { ModuleManifest } from "@core/module-contract";

import { buildHomeTiles } from "./home-tiles";

function makeModule(overrides: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id: "fake",
    routes: [],
    nav: [],
    i18nNamespace: "fake",
    ...overrides,
  };
}

describe("buildHomeTiles", () => {
  it("csak a primary + tile-os bejegyzéseket veszi fel, order szerint rendezve", () => {
    const modules: ModuleManifest[] = [
      makeModule({
        id: "b",
        i18nNamespace: "b",
        nav: [
          {
            labelKey: "nav.b",
            path: "/b",
            placement: "primary",
            order: 20,
            tile: { descriptionKey: "tile.b", icon: "gear" },
          },
        ],
      }),
      makeModule({
        id: "a",
        i18nNamespace: "a",
        nav: [
          {
            labelKey: "nav.a",
            path: "/a",
            placement: "primary",
            order: 10,
            tile: { descriptionKey: "tile.a", icon: "board" },
          },
        ],
      }),
    ];

    const tiles = buildHomeTiles(modules);

    expect(tiles.map((tile) => tile.path)).toEqual(["/a", "/b"]);
  });

  it("tile nélküli primary bejegyzés kimarad", () => {
    const modules: ModuleManifest[] = [
      makeModule({
        nav: [{ labelKey: "nav.advisor", path: "/deszkavalaszto", placement: "primary", order: 5 }],
      }),
    ];

    expect(buildHomeTiles(modules)).toEqual([]);
  });

  it("footer placement kimarad, még ha van is tile-ja", () => {
    const modules: ModuleManifest[] = [
      makeModule({
        nav: [
          {
            labelKey: "nav.footer",
            path: "/footer-link",
            placement: "footer",
            order: 90,
            tile: { descriptionKey: "tile.footer", icon: "info" },
          },
        ],
      }),
    ];

    expect(buildHomeTiles(modules)).toEqual([]);
  });

  it("a bejegyzés a saját modul i18nNamespace-ét hordozza", () => {
    const modules: ModuleManifest[] = [
      makeModule({
        id: "spots",
        i18nNamespace: "spots",
        nav: [
          {
            labelKey: "nav.spots",
            path: "/spotok",
            placement: "primary",
            order: 20,
            tile: { descriptionKey: "tile.spots", icon: "spot" },
          },
        ],
      }),
    ];

    const [tile] = buildHomeTiles(modules);
    expect(tile).toEqual({
      labelKey: "nav.spots",
      path: "/spotok",
      namespace: "spots",
      descriptionKey: "tile.spots",
      icon: "spot",
    });
  });
});
