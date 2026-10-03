/**
 * isServiceRoleRequest — csak a `role` claimet nézzük (az aláírást a gateway
 * verify_jwt-je már igazolta); itt a claim-kiolvasás helyességét teszteljük.
 */
import { describe, expect, it } from "vitest";

import { isServiceRoleRequest } from "./auth.ts";

function jwtOf(payload: unknown, header: unknown = { alg: "HS256", typ: "JWT" }): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode(header)}.${encode(payload)}.sig`;
}

describe("isServiceRoleRequest", () => {
  it("service_role JWT → true", () => {
    const header = `Bearer ${jwtOf({ role: "service_role" })}`;
    expect(isServiceRoleRequest(header)).toBe(true);
  });

  it("authenticated role → false", () => {
    const header = `Bearer ${jwtOf({ role: "authenticated", sub: "x" })}`;
    expect(isServiceRoleRequest(header)).toBe(false);
  });

  it("anon role → false", () => {
    const header = `Bearer ${jwtOf({ role: "anon" })}`;
    expect(isServiceRoleRequest(header)).toBe(false);
  });

  it("hiányzó fejléc → false", () => {
    expect(isServiceRoleRequest(null)).toBe(false);
  });

  it("nem Bearer séma → false", () => {
    const header = `Basic ${jwtOf({ role: "service_role" })}`;
    expect(isServiceRoleRequest(header)).toBe(false);
  });

  it("rossz base64 payload → false", () => {
    expect(isServiceRoleRequest("Bearer aaa.!!!not-base64!!!.sig")).toBe(false);
  });

  it("nem JSON payload → false", () => {
    const notJson = Buffer.from("plain text, not json").toString("base64url");
    expect(isServiceRoleRequest(`Bearer header.${notJson}.sig`)).toBe(false);
  });

  it("hiányzó role claim → false", () => {
    const header = `Bearer ${jwtOf({ sub: "abc" })}`;
    expect(isServiceRoleRequest(header)).toBe(false);
  });

  it("hiányzó szegmens (nem 3 részes JWT) → false", () => {
    expect(isServiceRoleRequest("Bearer only.two")).toBe(false);
  });

  it("payload nem objektum (pl. tömb) → false", () => {
    const header = `Bearer ${jwtOf(["service_role"])}`;
    expect(isServiceRoleRequest(header)).toBe(false);
  });
});
