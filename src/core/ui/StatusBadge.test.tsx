import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge, type StatusSeverity } from "./StatusBadge";

const STATUSES: StatusSeverity[] = ["safe", "caution", "danger", "stale"];

describe("StatusBadge", () => {
  it.each(STATUSES)("'%s' státusz mindig ikont ÉS szöveget renderel", (status) => {
    const label = `${status} felirat`;
    const { container } = render(<StatusBadge status={status} label={label} />);

    expect(screen.getByText(label)).toBeTruthy();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("a label prop kötelező szöveg, amely mindig látható marad (nem csak szín jelöli az állapotot)", () => {
    render(<StatusBadge status="danger" label="Veszélyes · 2,1" />);
    expect(screen.getByText("Veszélyes · 2,1")).toBeTruthy();
  });

  it("a safe/caution/danger tokenpárt a megfelelő -bg/-text osztályok adják", () => {
    const { container: safeC } = render(<StatusBadge status="safe" label="x" />);
    const { container: cautionC } = render(<StatusBadge status="caution" label="x" />);
    const { container: dangerC } = render(<StatusBadge status="danger" label="x" />);

    expect(safeC.querySelector("span")?.className).toContain("bg-safe-bg");
    expect(safeC.querySelector("span")?.className).toContain("text-safe-text");
    expect(cautionC.querySelector("span")?.className).toContain("bg-caution-bg");
    expect(cautionC.querySelector("span")?.className).toContain("text-caution-text");
    expect(dangerC.querySelector("span")?.className).toContain("bg-danger-bg");
    expect(dangerC.querySelector("span")?.className).toContain("text-danger-text");
  });

  it("stale státusz nem a --danger családot használja", () => {
    const { container } = render(<StatusBadge status="stale" label="Elavult adat" />);
    const className = container.querySelector("span")?.className ?? "";
    expect(className).toContain("text-stale");
    expect(className).not.toContain("danger");
  });
});
