import type { ComponentProps, ReactElement } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";

import { createI18n } from "@core/i18n";
import "@modules/spots/i18n";

import { StormAlertScreen } from "./StormAlertScreen";

function renderScreen(props: Partial<ComponentProps<typeof StormAlertScreen>> = {}) {
  const element: ReactElement = (
    <I18nextProvider i18n={createI18n("hu")}>
      <StormAlertScreen
        spotName="Balatonföldvár"
        source="BM OKF viharjelző rendszer"
        updatedAt="2026-07-19T09:38:00.000Z"
        gustKmh={65}
        {...props}
      />
    </I18nextProvider>
  );
  return render(element);
}

describe("StormAlertScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("role=alertdialog + aria-modal=true, aria-labelledby/describedby a saját tartalmára mutat", () => {
    renderScreen();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toBeTruthy();
  });

  it("nincs bezárás-gomb — a riasztás nem eldugható", () => {
    renderScreen();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("a vízimentő-hívó CTA helyes tel: linket ad, amber háttérrel és sötét szöveggel", () => {
    renderScreen();
    const link = screen.getByRole("link", { name: /Vízimentők hívása/i });
    expect(link.getAttribute("href")).toBe("tel:+36303838383");
    expect(link.className).toContain("bg-amber");
    expect(link.className).toContain("text-text");
    expect(link.className).not.toContain("bg-danger");
  });

  it("a MIT TEGYÉL 3 lépését jeleníti meg (a design 3 lépésére cserélt szöveg)", () => {
    renderScreen();
    expect(screen.getByText(/legközelebbi part felé/i)).toBeTruthy();
    expect(screen.getByText(/bokapórázt ne oldd ki/i)).toBeTruthy();
    expect(screen.getByText(/hívd a vízimentőket/i)).toBeTruthy();
  });

  it("forrás + időbélyeg sor megjelenik a snapshot fetchedAt-jából", () => {
    renderScreen();
    expect(screen.getByText(/BM OKF viharjelző rendszer/)).toBeTruthy();
    expect(screen.getByText(/Frissítve/)).toBeTruthy();
  });

  it("gustKmh nélkül is renderel (opcionális mondat kihagyva)", () => {
    renderScreen({ gustKmh: null });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.queryByText(/Várható széllökés/)).toBeNull();
  });
});
