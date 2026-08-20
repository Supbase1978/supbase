import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductImage } from "./ProductImage";

describe("ProductImage", () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Ez a komponens LÉTOKA. A gyártói termékrender erősen álló kép (470×1000),
   * a bolti életkép fekvő (1024×683). `object-cover`-rel egy alacsony sávba
   * vágva minden deszkából ugyanaz a felismerhetetlen színes csík lenne — épp
   * az veszne el, ami alapján a véleményező a modellek között eligazodik.
   */
  it("SOSEM vágja a képet: `object-contain`, nem `object-cover`", () => {
    const { container } = render(<ProductImage src="https://x.com/coral.png" alt="Coral" />);
    const img = screen.getByRole("img", { name: "Coral" });
    expect(img.className).toContain("object-contain");
    expect(container.innerHTML).not.toContain("object-cover");
  });

  it("a keret oldalaránya FIX — a kártyák képmezője egyforma marad", () => {
    const { container: card } = render(<ProductImage src="https://x.com/a.png" alt="A" />);
    const { container: hero } = render(
      <ProductImage src="https://x.com/b.png" alt="B" frame="hero" />,
    );
    expect(card.firstElementChild?.className).toContain("aspect-square");
    expect(hero.firstElementChild?.className).toContain("aspect-[3/2]");
  });

  it("kép nélkül is UGYANAKKORA keretet tart (nem ugrál a rács)", () => {
    const { container } = render(<ProductImage src={null} alt="Nincs kép" />);
    const frame = container.firstElementChild;
    expect(frame?.className).toContain("aspect-square");
    // Placeholder: dekoratív, a képernyőolvasónak nincs mit mondani róla.
    expect(frame?.getAttribute("aria-hidden")).toBe("true");
  });

  it("a hívó placeholderjét jeleníti meg kép híján (adatlap-gradiens)", () => {
    render(<ProductImage src={null} alt="X" fallback={<span data-testid="grad" />} />);
    expect(screen.getByTestId("grad")).toBeTruthy();
  });

  it("az alt-szöveg a terméknév — a képnek itt mindig van jelentése", () => {
    render(<ProductImage src="https://x.com/coral.png" alt="Aqua Marina Coral" />);
    expect(screen.getByAltText("Aqua Marina Coral")).toBeTruthy();
  });
});
