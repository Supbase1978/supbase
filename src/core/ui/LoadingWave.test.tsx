import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingWave } from "./LoadingWave";

describe("LoadingWave", () => {
  it("a képernyőolvasónak bemondja a betöltést (status + élő régió)", () => {
    render(<LoadingWave label="Térkép betöltése…" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Térkép betöltése…");
  });

  it("az információt a FELIRAT hordozza, az SVG dekoratív", () => {
    const { container } = render(<LoadingWave label="Betöltés" />);
    // Az SVG néma: ha csak animáció lenne felirat nélkül, a képernyőolvasó
    // használója nem tudná, hogy egyáltalán történik-e valami.
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Betöltés")).toBeTruthy();
  });

  it("csak semleges tokeneket használ — biztonsági szín NEM jelenhet meg", () => {
    const { container } = render(<LoadingWave label="Betöltés" />);
    const markup = container.innerHTML;
    // A betöltés nem állapot-információ a vízről: ha safe/caution/danger
    // színt villantana, a felhasználó valós jelzésnek hihetné (2. fejezet).
    for (const token of ["--safe", "--caution", "--danger", "--stale"]) {
      expect(markup).not.toContain(token);
    }
    expect(markup).toContain("--petrol");
  });

  it("a mozgás a `wave-drift` osztályon fut (így a reduced-motion kikapcsolja)", () => {
    const { container } = render(<LoadingWave label="Betöltés" />);
    // A tényleges leállítást a tokens.css `prefers-reduced-motion` blokkja
    // végzi; itt azt rögzítjük, hogy az animáció EHHEZ az osztályhoz kötött —
    // inline animációnál a médiakérdés nem tudná felülírni.
    expect(container.querySelectorAll(".wave-drift")).toHaveLength(2);
  });
});
