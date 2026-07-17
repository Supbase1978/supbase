import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("primary variáns (alapértelmezett) sötét ('text-text') feliratszín-osztályt kap amber háttéren", () => {
    render(<Button>Elsődleges CTA</Button>);
    const button = screen.getByRole("button", { name: "Elsődleges CTA" });
    expect(button.className).toContain("bg-amber");
    expect(button.className).toContain("text-text");
    // Biztosan NEM fehér/surface szöveg — az amber CTA-n mindig sötét felirat kötelező.
    expect(button.className).not.toContain("text-surface");
  });

  it("primary variáns a --cta-height magasságot kapja", () => {
    render(<Button variant="primary">CTA</Button>);
    const button = screen.getByRole("button", { name: "CTA" });
    expect(button.className).toContain("h-[var(--cta-height)]");
  });

  it("secondary variáns petrol hátteret és világos (surface) szöveget kap", () => {
    render(<Button variant="secondary">Másodlagos</Button>);
    const button = screen.getByRole("button", { name: "Másodlagos" });
    expect(button.className).toContain("bg-petrol");
    expect(button.className).toContain("text-surface");
  });

  it("ghost variáns kontúros, átlátszó hátterű", () => {
    render(<Button variant="ghost">Harmadlagos</Button>);
    const button = screen.getByRole("button", { name: "Harmadlagos" });
    expect(button.className).toContain("border-line");
    expect(button.className).toContain("bg-transparent");
  });

  it("minden variáns legalább a --tap-min tap-méretet kapja", () => {
    render(
      <>
        <Button variant="secondary">A</Button>
        <Button variant="ghost">B</Button>
      </>,
    );
    for (const name of ["A", "B"]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "min-h-[var(--tap-min)]",
      );
    }
  });

  it("nincs 'danger' variáns a típus-API-ban (a --danger interakciós elemen tilos)", () => {
    // @ts-expect-error — a Button típusa szándékosan nem enged "danger" variánst.
    render(<Button variant="danger">Tilos</Button>);
  });

  it("onClick meghívódik kattintásra, disabled esetén nem", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Kattints</Button>);
    await user.click(screen.getByRole("button", { name: "Kattints" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    const onClickDisabled = vi.fn();
    render(
      <Button onClick={onClickDisabled} disabled>
        Tiltott
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Tiltott" }));
    expect(onClickDisabled).not.toHaveBeenCalled();
  });
});
