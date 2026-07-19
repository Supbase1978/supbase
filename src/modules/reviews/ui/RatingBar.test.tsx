import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RatingBar } from "./RatingBar";

function segments(container: HTMLElement): HTMLSpanElement[] {
  return Array.from(container.querySelectorAll("div[role='img'] > span"));
}

describe("RatingBar", () => {
  it("10 szegmenst rajzol, a value-nak megfelelő számút kitöltve (kerekítve)", () => {
    const { container } = render(<RatingBar value={7.4} />);
    const segs = segments(container);
    expect(segs).toHaveLength(10);
    const filled = segs.filter((s) => !s.className.includes("bg-line"));
    expect(filled).toHaveLength(7);
  });

  it("érték ≥ 7 → safe (zöld) kitöltés, SOHA nem danger", () => {
    const { container } = render(<RatingBar value={9.1} />);
    const filled = segments(container).filter((s) => s.className.includes("bg-safe"));
    expect(filled.length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toContain("bg-danger");
  });

  it("érték < 7 → caution (amber) kitöltés, SOHA nem danger", () => {
    const { container } = render(<RatingBar value={6} />);
    const filled = segments(container).filter((s) => s.className.includes("bg-caution"));
    expect(filled).toHaveLength(6);
    expect(container.innerHTML).not.toContain("bg-danger");
  });

  it("null érték → nincs kitöltött szegmens", () => {
    const { container } = render(<RatingBar value={null} />);
    const filled = segments(container).filter(
      (s) => s.className.includes("bg-safe") || s.className.includes("bg-caution"),
    );
    expect(filled).toHaveLength(0);
  });
});
