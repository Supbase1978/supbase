import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { pathWithoutQuery, recordEvent, shouldSkipTracking } from "./analytics.server";
import { ANALYTICS_EVENTS, isAnalyticsEvent } from "./events";

function request(url = "https://suptime.hu/spotok", headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

/** A vitest DEV-módban fut, ezért a produkciós viselkedést explicit kérjük. */
const PROD = { dev: false } as const;

function clientWith(rpc: ReturnType<typeof vi.fn>): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

describe("shouldSkipTracking", () => {
  it("robotot nem számol (a crawler-forgalom elfedné a valódi használatot)", () => {
    expect(shouldSkipTracking(request("https://suptime.hu/", { "user-agent": "Googlebot/2.1" }), PROD)).toBe(
      true,
    );
  });

  it("valódi böngészőt igen", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
    expect(shouldSkipTracking(request("https://suptime.hu/", { "user-agent": ua }), PROD)).toBe(false);
  });

  it.each([
    ["dnt", "1"],
    ["sec-gpc", "1"],
  ])("tiszteletben tartja a nyomkövetés-elutasítást (%s)", (header, value) => {
    expect(shouldSkipTracking(request("https://suptime.hu/", { [header]: value }), PROD)).toBe(true);
  });
});

describe("pathWithoutQuery", () => {
  it("levágja a query-t — a megosztott advisor-link TESTSÚLYT tartalmaz", () => {
    expect(pathWithoutQuery("https://suptime.hu/deszkavalaszto?suly=85&magassag=180")).toBe(
      "/deszkavalaszto",
    );
  });

  it("nem URL-alakú bemenetnél sem dob", () => {
    expect(pathWithoutQuery("/spotok?x=1")).toBe("/spotok");
  });
});

describe("recordEvent", () => {
  it("az RPC-t hívja, query nélküli útvonallal", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const ok = await recordEvent(
      clientWith(rpc),
      request("https://suptime.hu/deszkavalaszto?suly=85"),
      "advisor_result_view",
      { props: { water: "folyo" }, ...PROD },
    );
    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("record_analytics_event", {
      p_name: "advisor_result_view",
      p_path: "/deszkavalaszto",
      p_props: { water: "folyo" },
    });
  });

  it("robotnál meg sem hívja az adatbázist", async () => {
    const rpc = vi.fn();
    const ok = await recordEvent(
      clientWith(rpc),
      request("https://suptime.hu/", { "user-agent": "bingbot/2.0" }),
      "page_view",
      PROD,
    );
    expect(ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("DB-hiba esetén NEM dob — a mérés nem buktathat oldalt", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("connection refused"));
    await expect(
      recordEvent(clientWith(rpc), request(), "page_view", PROD),
    ).resolves.toBe(false);
  });

  it("RPC-hibaválasznál sem dob, csak false-t ad", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "permission denied" } });
    expect(await recordEvent(clientWith(rpc), request(), "page_view", PROD)).toBe(false);
  });

  it("lassú adatbázisnál feladja (a mérés nem lassíthatja az oldalt)", async () => {
    vi.useFakeTimers();
    const rpc = vi.fn().mockReturnValue(new Promise(() => {}));
    const promise = recordEvent(clientWith(rpc), request(), "page_view", PROD);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await promise).toBe(false);
    vi.useRealTimers();
  });
});

describe("eseménynevek", () => {
  it("a lista zárt: ismeretlen név nem esemény", () => {
    expect(isAnalyticsEvent("page_view")).toBe(true);
    expect(isAnalyticsEvent("kattintas")).toBe(false);
  });

  it("nincs duplikátum a listában", () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });
});
