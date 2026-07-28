import { describe, expect, it } from "vitest";

import { projectRefFromUrl, refFromServiceKey, resolveSupabaseTarget } from "./env.ts";

/** Kulcs-imitáció: aláírás nélküli JWT a `ref` claimmel (nem titok, nem valós kulcs). */
function fakeKey(ref: string): string {
  const payload = Buffer.from(JSON.stringify({ iss: "supabase", ref, role: "service_role" }))
    .toString("base64url");
  return `header.${payload}.signature`;
}

const OURS = "pycsqnthxaytwaptbiph";
const FOREIGN = "zpwoicpajmvbtmtumsah";
const OUR_URL = `https://${OURS}.supabase.co`;

describe("projectRefFromUrl", () => {
  it.each([
    [OUR_URL, OURS],
    [`${OUR_URL}/rest/v1`, OURS],
    ["https://example.com", null],
    ["nem-url", null],
  ])("%s → %s", (url, expected) => {
    expect(projectRefFromUrl(url)).toBe(expected);
  });
});

describe("refFromServiceKey", () => {
  it("kiolvassa a ref claimet a JWT-ből", () => {
    expect(refFromServiceKey(fakeKey(OURS))).toBe(OURS);
  });

  it("nem JWT alakú kulcsnál null (nincs mit összevetni)", () => {
    expect(refFromServiceKey("sb_secret_abc123")).toBeNull();
    expect(refFromServiceKey("a.b")).toBeNull();
  });
});

describe("resolveSupabaseTarget", () => {
  it("a repo .env-je ERŐSEBB a shell-környezetnél", () => {
    const target = resolveSupabaseTarget(
      { VITE_SUPABASE_URL: OUR_URL, SUPABASE_SERVICE_ROLE_KEY: fakeKey(OURS) },
      {
        SUPABASE_URL: `https://${FOREIGN}.supabase.co`,
        SUPABASE_SERVICE_ROLE_KEY: fakeKey(FOREIGN),
      },
    );
    expect(target.projectRef).toBe(OURS);
    expect(target.key).toBe(fakeKey(OURS));
    expect(target.warnings[0]).toMatch(/MÁS projektre mutat/);
  });

  it("NEM veszi át a shell kulcsát, ha a projektet a .env adja", () => {
    expect(() =>
      resolveSupabaseTarget(
        { VITE_SUPABASE_URL: OUR_URL },
        { SUPABASE_SERVICE_ROLE_KEY: fakeKey(FOREIGN) },
      ),
    ).toThrow(/Hiányzó SUPABASE_SERVICE_ROLE_KEY a repo \.env-jében/);
  });

  it("LEÁLL, ha a kulcs másik projekthez tartozik", () => {
    expect(() =>
      resolveSupabaseTarget(
        { VITE_SUPABASE_URL: OUR_URL, SUPABASE_SERVICE_ROLE_KEY: fakeKey(FOREIGN) },
        {},
      ),
    ).toThrow(/MÁSIK projekthez tartozik/);
  });

  it(".env nélkül (CI) a környezeti változók élnek", () => {
    const target = resolveSupabaseTarget(
      {},
      { SUPABASE_URL: OUR_URL, SUPABASE_SERVICE_ROLE_KEY: fakeKey(OURS) },
    );
    expect(target.projectRef).toBe(OURS);
    expect(target.warnings).toEqual([]);
  });

  it("hiányzó URL-re beszédes hibát dob", () => {
    expect(() => resolveSupabaseTarget({}, {})).toThrow(/Hiányzó Supabase-URL/);
  });

  it("ref nélküli (sb_secret_) kulcsot elfogad — nincs mit összevetni", () => {
    const target = resolveSupabaseTarget(
      { VITE_SUPABASE_URL: OUR_URL, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_valami" },
      {},
    );
    expect(target.key).toBe("sb_secret_valami");
  });
});
