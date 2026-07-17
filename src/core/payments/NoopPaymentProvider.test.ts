import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoopPaymentProvider } from "./NoopPaymentProvider";

describe("NoopPaymentProvider", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("rejects createCheckout with a structured, non-ok result and logs a warning", async () => {
    const provider = new NoopPaymentProvider();
    const result = await provider.createCheckout({
      id: "order-1",
      userId: "user-1",
      kind: "booking",
      amountHuf: 10000,
      currency: "HUF",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nincs bekapcsolva/i);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("rejects handleWebhook", async () => {
    const provider = new NoopPaymentProvider();
    const result = await provider.handleWebhook({
      id: "evt-1",
      type: "checkout.session.completed",
      receivedAt: new Date().toISOString(),
      payload: {},
    });

    expect(result.ok).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("returns no entitlements", async () => {
    const provider = new NoopPaymentProvider();
    const entitlements = await provider.getEntitlements("user-1");

    expect(entitlements).toEqual([]);
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
