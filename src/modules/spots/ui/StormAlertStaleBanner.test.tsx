import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";

import { createI18n } from "@core/i18n";
// Namespace-regisztráció mellékhatása (a spots ns kelleni fog a createI18n-hez).
import "@modules/spots/i18n";

import { StormAlertStaleBanner } from "./StormAlertStaleBanner";

afterEach(cleanup);

function renderBanner() {
  return render(
    <I18nextProvider i18n={createI18n("hu")}>
      <StormAlertStaleBanner
        ageLabel="2 órája"
        sourceUrl="https://www.met.hu/idojaras/tavaink/balaton/viharjelzes/main.php"
      />
    </I18nextProvider>,
  );
}

describe("StormAlertStaleBanner", () => {
  it("NEM modális (nincs alertdialog, nincs aria-modal)", () => {
    renderBanner();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("NEM danger-osztályú háttér (--stale, nem --danger)", () => {
    const { container } = renderBanner();
    expect(container.querySelector(".bg-danger")).toBeNull();
    expect(container.textContent).not.toContain("bg-danger");
  });

  it("múlt időben, 'Utolsó ismert állapot' címmel és a korral jelenik meg", () => {
    renderBanner();
    expect(screen.getByText("Utolsó ismert állapot: viharjelzés")).not.toBeNull();
    expect(screen.getByText(/2 órája frissült adat szerint/)).not.toBeNull();
  });

  it("linket ad a hivatalos forrásra, új lapon nyílva", () => {
    renderBanner();
    const link = screen.getByRole("link", { name: /Hivatalos forrás megtekintése/ });
    expect(link.getAttribute("href")).toBe(
      "https://www.met.hu/idojaras/tavaink/balaton/viharjelzes/main.php",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
