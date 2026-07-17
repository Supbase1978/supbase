import { describe, expect, it } from "vitest";

import { defaultRole, getUserRole, hasRole, isRole, roles, type Role } from "./roles";

describe("hasRole", () => {
  // Elvárt lefedés: egy szint mindig lefedi a nála alacsonyabbat, magasabbat nem.
  const expected: Record<Role, Record<Role, boolean>> = {
    user: { user: true, moderator: false, admin: false },
    moderator: { user: true, moderator: true, admin: false },
    admin: { user: true, moderator: true, admin: true },
  };

  for (const userRole of roles) {
    for (const required of roles) {
      it(`${userRole} vs ${required} → ${expected[userRole][required]}`, () => {
        expect(hasRole(userRole, required)).toBe(expected[userRole][required]);
      });
    }
  }
});

describe("isRole", () => {
  it("felismeri az érvényes szerepeket", () => {
    for (const role of roles) {
      expect(isRole(role)).toBe(true);
    }
  });

  it("elutasít ismeretlen / nem-string értéket", () => {
    expect(isRole("superadmin")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(1)).toBe(false);
  });
});

describe("getUserRole", () => {
  it("null/undefined user → default (user)", () => {
    expect(getUserRole(null)).toBe(defaultRole);
    expect(getUserRole(undefined)).toBe("user");
  });

  it("érvényes app_metadata.role claim-et olvas", () => {
    expect(getUserRole({ app_metadata: { role: "admin" } })).toBe("admin");
    expect(getUserRole({ app_metadata: { role: "moderator" } })).toBe("moderator");
  });

  it("ismeretlen/hamis claim SOHA nem ad emelt jogot → default", () => {
    expect(getUserRole({ app_metadata: { role: "root" } })).toBe("user");
    expect(getUserRole({ app_metadata: {} })).toBe("user");
    expect(getUserRole({ app_metadata: { role: 42 } })).toBe("user");
  });
});
