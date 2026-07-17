import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEFAULT_GAUGE_THRESHOLDS, Gauge } from "./Gauge";

function getSegments(container: HTMLElement): HTMLElement[] {
  const meter = container.querySelector('[role="meter"]');
  if (!meter) throw new Error("meter nem található");
  return Array.from(meter.children) as HTMLElement[];
}

describe("Gauge", () => {
  it("mindig 10 szegmenst renderel", () => {
    const { container } = render(<Gauge value={5} label="SUP-index 5" />);
    expect(getSegments(container)).toHaveLength(10);
  });

  it("a value kerekítve adja a kitöltött szegmensek számát (8,4 -> 8)", () => {
    const { container } = render(<Gauge value={8.4} label="SUP-index 8,4" />);
    const filled = getSegments(container).filter(
      (el) => el.dataset.filled === "true",
    );
    expect(filled).toHaveLength(8);
  });

  it("a tartomány szélein clampel (érték 12 -> 10 kitöltött, -3 -> 0 kitöltött)", () => {
    const { container: high } = render(<Gauge value={12} label="x" />);
    const { container: low } = render(<Gauge value={-3} label="x" />);
    expect(
      getSegments(high).filter((el) => el.dataset.filled === "true"),
    ).toHaveLength(10);
    expect(
      getSegments(low).filter((el) => el.dataset.filled === "true"),
    ).toHaveLength(0);
  });

  it("a küszöbök szerint danger/caution/safe színt kap a kitöltés", () => {
    const { container: dangerC } = render(
      <Gauge value={2} label="danger" thresholds={DEFAULT_GAUGE_THRESHOLDS} />,
    );
    const { container: cautionC } = render(
      <Gauge value={5} label="caution" thresholds={DEFAULT_GAUGE_THRESHOLDS} />,
    );
    const { container: safeC } = render(
      <Gauge value={8} label="safe" thresholds={DEFAULT_GAUGE_THRESHOLDS} />,
    );

    expect(dangerC.querySelector('[role="meter"]')?.getAttribute("data-severity")).toBe(
      "danger",
    );
    expect(
      cautionC.querySelector('[role="meter"]')?.getAttribute("data-severity"),
    ).toBe("caution");
    expect(safeC.querySelector('[role="meter"]')?.getAttribute("data-severity")).toBe(
      "safe",
    );
  });

  it("stale állapotban a data-severity 'stale' és a kitöltött szegmensek csíkozott mintát kapnak", () => {
    const { container } = render(<Gauge value={8} label="elavult" stale />);
    const meter = container.querySelector('[role="meter"]');
    expect(meter?.getAttribute("data-severity")).toBe("stale");

    const filled = getSegments(container).filter(
      (el) => el.dataset.filled === "true",
    );
    for (const segment of filled) {
      expect(segment.style.backgroundImage).toContain("repeating-linear-gradient");
      expect(segment.style.backgroundImage).toContain("var(--stale)");
    }
  });

  it("aria attribútumok a value-t és a label-t tükrözik", () => {
    const { container } = render(<Gauge value={6.5} label="SUP-index 6,5" />);
    const meter = container.querySelector('[role="meter"]');
    expect(meter?.getAttribute("aria-label")).toBe("SUP-index 6,5");
    expect(meter?.getAttribute("aria-valuemin")).toBe("0");
    expect(meter?.getAttribute("aria-valuemax")).toBe("10");
    expect(meter?.getAttribute("aria-valuenow")).toBe("6.5");
  });
});
