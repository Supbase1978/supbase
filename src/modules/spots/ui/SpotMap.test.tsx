import type { ReactElement } from "react";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createI18n } from "@core/i18n";
// Namespace-regisztráció mellékhatása (a spots ns kelleni fog a createI18n-hez).
import "@modules/spots/i18n";

import { SpotMap, type SpotMapMarker } from "./SpotMap";

const hoisted = vi.hoisted(() => {
  const instances: Array<{ options: Record<string, unknown> }> = [];
  return { instances };
});

vi.mock("maplibre-gl", () => {
  class FakeMap {
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      hoisted.instances.push(this);
    }
    remove = vi.fn();
    on = vi.fn();
    off = vi.fn();
  }

  class FakeMarker {
    setLngLat() {
      return this;
    }
    setPopup() {
      return this;
    }
    addTo() {
      return this;
    }
    remove = vi.fn();
  }

  class FakePopup {
    setDOMContent() {
      return this;
    }
  }

  return { Map: FakeMap, Marker: FakeMarker, Popup: FakePopup };
});

const SPOTS: SpotMapMarker[] = [
  {
    id: "1",
    name: "Tihany",
    slug: "tihany",
    lat: 46.9,
    lng: 17.9,
    status: "safe",
    stale: false,
    protectedArea: false,
  },
  {
    id: "2",
    name: "Balatonföldvár",
    slug: "balatonfoldvar",
    lat: 46.8,
    lng: 17.88,
    status: "forbidden",
    stale: false,
    protectedArea: true,
  },
];

function withI18n(node: ReactElement) {
  return <I18nextProvider i18n={createI18n("hu")}>{node}</I18nextProvider>;
}

describe("SpotMap", () => {
  beforeEach(() => {
    hoisted.instances.length = 0;
  });

  // A projekt vitest.config.ts-e nem állít be globális `afterEach(cleanup)`-ot
  // (nincs `test.globals`) — a több render()-t használó tesztek miatt itt
  // explicit kell (különben a `screen` a korábbi renderek DOM-ját is látja).
  afterEach(() => {
    cleanup();
  });

  it("SSR-en (renderToStaticMarkup, effektek nélkül) token-színezett placeholdert ad, MapLibre-hívás nélkül", () => {
    const markup = renderToStaticMarkup(
      withI18n(<SpotMap spots={SPOTS} />),
    );
    expect(markup).toContain("Térkép");
    expect(hoisted.instances).toHaveLength(0);
  });

  it("mountolás után a helyes stílus-URL-lel inicializálja a MapLibre-térképet", async () => {
    render(withI18n(<SpotMap spots={SPOTS} />));

    await waitFor(() => expect(hoisted.instances).toHaveLength(1));
    expect(hoisted.instances[0]?.options.style).toBe(
      "https://tiles.openfreemap.org/styles/liberty",
    );
  });

  it("interactive=false esetén a réteg-kapcsolók nem jelennek meg", async () => {
    render(withI18n(<SpotMap spots={SPOTS} interactive={false} />));
    await waitFor(() => expect(hoisted.instances).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Spotok" })).toBeNull();
  });

  it("interactive (alapértelmezett) esetén a réteg-kapcsolók 44px tap-targettel jelennek meg", async () => {
    render(withI18n(<SpotMap spots={SPOTS} />));
    await waitFor(() => expect(hoisted.instances).toHaveLength(1));

    const spotsToggle = screen.getByRole("button", { name: "Spotok" });
    expect(spotsToggle.className).toContain("min-h-[var(--tap-min)]");

    const protectedToggle = screen.getByRole("button", { name: "Védett területek" });
    expect(protectedToggle.getAttribute("aria-pressed")).toBe("true");
  });
});
