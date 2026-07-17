import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildLoginRedirect, getUser, requireUser, safeRedirect } from "./session.server";

describe("getUser / requireUser — fail-closed hiányzó Supabase-env mellett", () => {
  beforeEach(() => {
    // Env nélkül nincs kliens: a session-olvasás null-t ad, nem dob (nem hív hálózatot).
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("getUser → null (nem throw), ha nincs Supabase-env", async () => {
    await expect(getUser(new Request("https://app.hu/deszkak/1"))).resolves.toBeNull();
  });

  it("requireUser → redirect a belépésre (302, redirectTo-val), ha nincs session", async () => {
    try {
      await requireUser(new Request("https://app.hu/deszkak/1"));
      expect.unreachable("requireUser-nak redirectet kellett volna dobnia");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Response);
      const response = thrown as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/belepes?redirectTo=%2Fdeszkak%2F1");
    }
  });
});

describe("buildLoginRedirect — locale-helyes cél + redirectTo", () => {
  it("hu útvonal → prefix nélküli /belepes, redirectTo az eredeti útra", () => {
    const target = buildLoginRedirect(new Request("https://app.hu/deszkak/123"));
    expect(target).toBe("/belepes?redirectTo=%2Fdeszkak%2F123");
  });

  it("en-prefixes útvonal → /en/belepes, redirectTo a teljes (prefixes) útra", () => {
    const target = buildLoginRedirect(new Request("https://app.hu/en/boards/123"));
    expect(target).toBe("/en/belepes?redirectTo=%2Fen%2Fboards%2F123");
  });

  it("query-t is megőrzi a redirectTo-ban", () => {
    const target = buildLoginRedirect(new Request("https://app.hu/spot?tab=info"));
    const returned = new URL(`https://app.hu${target}`).searchParams.get("redirectTo");
    expect(returned).toBe("/spot?tab=info");
  });
});

describe("safeRedirect — nyílt-redirect védelem", () => {
  it("app-belső abszolút útvonalat átenged", () => {
    expect(safeRedirect("/deszkak/123")).toBe("/deszkak/123");
    expect(safeRedirect("/en/boards")).toBe("/en/boards");
  });

  it("protokoll-relatív (//host) és külső URL → fallback", () => {
    expect(safeRedirect("//evil.example")).toBe("/");
    expect(safeRedirect("https://evil.example")).toBe("/");
  });

  it("backslash-alak (/\\host) → fallback (a böngésző //host-ra normalizálná)", () => {
    expect(safeRedirect("/\\evil.example")).toBe("/");
    expect(safeRedirect("/\\/evil.example")).toBe("/");
  });

  it("hiányzó/nem-string érték → fallback (alap: /)", () => {
    expect(safeRedirect(null)).toBe("/");
    expect(safeRedirect(undefined)).toBe("/");
    expect(safeRedirect("")).toBe("/");
    expect(safeRedirect(null, "/belepes")).toBe("/belepes");
  });
});
