import type { ReactElement } from "react";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createI18n } from "@core/i18n";
// Namespace-regisztráció mellékhatása (a spots ns kelleni fog a createI18n-hez).
import "@modules/spots/i18n";

import { DirectionsLink } from "./DirectionsLink";

function withI18n(node: ReactElement) {
  return <I18nextProvider i18n={createI18n("hu")}>{node}</I18nextProvider>;
}

describe("DirectionsLink", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("nem-Apple platformon (alapértelmezett) a Google Maps-linkre mutat", async () => {
    vi.stubGlobal("navigator", { ...navigator, platform: "Win32", userAgent: "Windows NT" });
    render(withI18n(<DirectionsLink lat={46.9} lng={17.9} />));

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Útvonal" });
      expect(link.getAttribute("href")).toBe(
        "https://www.google.com/maps/dir/?api=1&destination=46.9,17.9",
      );
    });
  });

  it("Apple UA-n (iPhone) az Apple Maps-linkre vált", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      platform: "iPhone",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });
    render(withI18n(<DirectionsLink lat={46.9} lng={17.9} />));

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Útvonal" });
      expect(link.getAttribute("href")).toBe("https://maps.apple.com/?daddr=46.9,17.9");
    });
  });

  it("új lapon nyit, `noopener noreferrer`-rel", () => {
    render(withI18n(<DirectionsLink lat={46.9} lng={17.9} />));
    const link = screen.getByRole("link", { name: "Útvonal" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("legalább a --tap-min tap-méretet kapja", () => {
    render(withI18n(<DirectionsLink lat={46.9} lng={17.9} />));
    const link = screen.getByRole("link", { name: "Útvonal" });
    expect(link.className).toContain("min-h-[var(--tap-min)]");
  });
});
