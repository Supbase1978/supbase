import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Waterline, type WaterlineState } from "./Waterline";

const STATES: WaterlineState[] = ["calm", "choppy", "broken", "stale"];

function getPathD(container: HTMLElement): string {
  const path = container.querySelector("path");
  if (!path) throw new Error("path nem található");
  return path.getAttribute("d") ?? "";
}

describe("Waterline", () => {
  it("role=img és a kötelező label aria-label-ként jelenik meg", () => {
    render(<Waterline state="calm" label="Kiváló — nyugodt vízfelszín" />);
    expect(
      screen.getByRole("img", { name: "Kiváló — nyugodt vízfelszín" }),
    ).toBeTruthy();
  });

  it("mind a 4 állapot eltérő vonalgeometriát (path d) renderel", () => {
    const paths = STATES.map((state) => {
      const { container } = render(<Waterline state={state} label={state} />);
      return getPathD(container);
    });

    const unique = new Set(paths);
    expect(unique.size).toBe(STATES.length);
  });

  it("a 'broken' állapot szögletes (L parancsokból épülő) útvonalat rajzol", () => {
    const { container } = render(<Waterline state="broken" label="töredezett" />);
    const d = getPathD(container);
    expect(d).toContain("L");
    expect(d).not.toContain("Q");
  });

  it("a 'calm' és 'choppy' állapot sima (Q/T parancsú) útvonalat rajzol", () => {
    const { container: calm } = render(<Waterline state="calm" label="nyugodt" />);
    const { container: choppy } = render(<Waterline state="choppy" label="fodrozódó" />);
    expect(getPathD(calm)).toContain("Q");
    expect(getPathD(choppy)).toContain("Q");
  });

  it("csak a 'stale' állapot szaggatott (stroke-dasharray)", () => {
    for (const state of STATES) {
      const { container } = render(<Waterline state={state} label={state} />);
      const path = container.querySelector("path");
      const dasharray = path?.getAttribute("stroke-dasharray");
      if (state === "stale") {
        expect(dasharray).toBeTruthy();
      } else {
        expect(dasharray).toBeFalsy();
      }
    }
  });

  it("a data-waterline-state attribútum az adott state-et tükrözi", () => {
    const { container } = render(<Waterline state="broken" label="x" />);
    expect(container.querySelector("svg")?.getAttribute("data-waterline-state")).toBe(
      "broken",
    );
  });
});
