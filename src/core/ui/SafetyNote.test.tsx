import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SafetyNote } from "./SafetyNote";

describe("SafetyNote", () => {
  afterEach(() => {
    cleanup();
  });

  it("a címet régió-felirattá teszi, hogy képernyőolvasóval megtalálható legyen", () => {
    render(<SafetyNote title="Folyóvízen más póráz kell">tartalom</SafetyNote>);
    expect(screen.getByRole("region", { name: "Folyóvízen más póráz kell" })).toBeTruthy();
  });

  it("NEM használ biztonsági státusz-színt: az állandó tanács nem állapotjelzés", () => {
    const { container } = render(<SafetyNote title="cím">tartalom</SafetyNote>);
    const html = container.innerHTML;
    // A --safe/--caution/--danger család a MÉRT állapoté (2. fejezet 3.) —
    // ha ide beszivárogna, a felhasználó megszokná a riasztás-színt ott,
    // ahol nincs friss veszély.
    expect(html).not.toMatch(/bg-(safe|caution|danger)/);
    expect(html).toContain("bg-sand");
  });

  it("a tartalmat változatlanul rendereli (a szöveg a hívótól, i18n-ből jön)", () => {
    render(
      <SafetyNote title="cím">
        <p>első</p>
        <p>második</p>
      </SafetyNote>,
    );
    expect(screen.getByText("első")).toBeTruthy();
    expect(screen.getByText("második")).toBeTruthy();
  });
});
