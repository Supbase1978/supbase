import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoutesStub } from "react-router";

import { HomeTile, type HomeTileProps } from "./HomeTile";

// Nincs globális vitest-setup ehhez a jest-dom/cleanup-hoz — több `render()`
// hívás a fájlon belül a document.body-ban halmozódna, és a névre kereső
// query-k (`getByRole(..., { name })`) szigorú módban elhasalnának.
afterEach(cleanup);

function renderTile(props: Partial<HomeTileProps> = {}) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <HomeTile
          to="/spotok"
          icon="spot"
          title="Spotok"
          description="Élő SUP-index a vizeken"
          {...props}
        />
      ),
    },
  ]);
  return render(<Stub />);
}

describe("HomeTile", () => {
  it("a teljes csempe egy link a megadott célra", () => {
    renderTile();
    const link = screen.getByRole("link", { name: /Spotok/ });
    expect(link.getAttribute("href")).toBe("/spotok");
  });

  it("megjeleníti a címet és a leírást", () => {
    renderTile();
    expect(screen.getByText("Spotok")).toBeTruthy();
    expect(screen.getByText("Élő SUP-index a vizeken")).toBeTruthy();
  });

  it("az ikon aria-hidden, nem zaklatja a screen readert", () => {
    const { container } = renderTile();
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("a tap-cél legalább a --tap-min méretet kapja", () => {
    renderTile();
    const link = screen.getByRole("link", { name: /Spotok/ });
    expect(link.className).toContain("min-h-[var(--tap-min)]");
  });

  it("csempénként eltérő pasztell ikon-doboz színt kap, a link marad az egyetlen interaktív elem", () => {
    const { container: boardContainer } = renderTile({ icon: "board", title: "Deszkák" });
    const boardBox = boardContainer.querySelector("svg")?.parentElement;
    cleanup();

    const { container: infoContainer } = renderTile({ icon: "info", title: "Alapvető inf." });
    const infoBox = infoContainer.querySelector("svg")?.parentElement;

    expect(boardBox?.className).toContain("bg-tile-board-bg");
    expect(boardBox?.className).toContain("text-tile-board-ink");
    expect(infoBox?.className).toContain("bg-tile-info-bg");
    expect(infoBox?.className).toContain("text-tile-info-ink");
    expect(boardBox?.className).not.toBe(infoBox?.className);

    const links = infoContainer.querySelectorAll("a, button");
    expect(links.length).toBe(1);
  });
});
