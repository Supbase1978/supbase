import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it("svg-t renderel, dekoratívként (aria-hidden, nem fókuszálható)", () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
  });

  it("alapértelmezett mérete 28px", () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("28");
    expect(svg?.getAttribute("height")).toBe("28");
  });

  it("a `size` prop-ot tiszteletben tartja", () => {
    const { container } = render(<BrandMark size={40} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("40");
    expect(svg?.getAttribute("height")).toBe("40");
  });

  it("a `className` prop-ot átadja az svg-nek", () => {
    const { container } = render(<BrandMark className="shrink-0" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("shrink-0");
  });
});
