/**
 * push-notify tesztek — célzás (ki kap) és üzenet-tartalom (9./3–4.).
 * A „ki kap" a biztonságkritikus rész: rossz célzásnál vagy elmarad a
 * riasztás, vagy olyan kap tiltó üzenetet, aki nem is arra a vízre iratkozott.
 */
import { describe, expect, it } from "vitest";

import {
  buildStormPushPayload,
  buildStormPushTargets,
  formatSpotNames,
  parseWebPushToken,
  type AffectedSpot,
  type PushSubscriptionRow,
} from "./push-notify";

const NOW = new Date("2026-07-24T14:35:00Z"); // 16:35 budapesti idő
const OPTIONS = { now: NOW, source: "met.hu / BM OKF" };

const SPOTS: AffectedSpot[] = [
  { spotId: "s1", name: "Balatonföldvár", path: "/spotok/balatonfoldvar" },
  { spotId: "s2", name: "Siófok", path: "/spotok/siofok" },
  { spotId: "s3", name: "Tihany", path: "/spotok/tihany" },
];

function sub(overrides: Partial<PushSubscriptionRow> = {}): PushSubscriptionRow {
  return {
    id: "sub-1",
    platform: "webpush",
    token: { endpoint: "https://push.example/1", keys: { p256dh: "PUB", auth: "AUTH" } },
    alert_spot_ids: ["s1"],
    ...overrides,
  };
}

describe("parseWebPushToken", () => {
  it("elfogadja a böngésző natív alakját (keys-objektum)", () => {
    expect(
      parseWebPushToken({ endpoint: "https://e", keys: { p256dh: "p", auth: "a" } }),
    ).toEqual({ endpoint: "https://e", p256dh: "p", auth: "a" });
  });

  it("elfogadja a lapos alakot is", () => {
    expect(parseWebPushToken({ endpoint: "https://e", p256dh: "p", auth: "a" })).toEqual({
      endpoint: "https://e",
      p256dh: "p",
      auth: "a",
    });
  });

  it.each([
    ["null", null],
    ["string", "nem objektum"],
    ["hiányzó endpoint", { keys: { p256dh: "p", auth: "a" } }],
    ["üres endpoint", { endpoint: "", keys: { p256dh: "p", auth: "a" } }],
    ["hiányzó p256dh", { endpoint: "https://e", keys: { auth: "a" } }],
    ["hiányzó auth", { endpoint: "https://e", keys: { p256dh: "p" } }],
    ["nem string mező", { endpoint: "https://e", keys: { p256dh: 1, auth: "a" } }],
  ])("null-t ad érvénytelen tokenre (%s)", (_label, token) => {
    expect(parseWebPushToken(token)).toBeNull();
  });
});

describe("formatSpotNames", () => {
  it("legfeljebb hármat sorol fel", () => {
    expect(formatSpotNames(["A"])).toBe("A");
    expect(formatSpotNames(["A", "B", "C"])).toBe("A, B, C");
  });

  it("négytől összevonja a maradékot", () => {
    expect(formatSpotNames(["A", "B", "C", "D", "E"])).toBe("A, B, C és még 2");
  });
});

describe("buildStormPushPayload", () => {
  it("II. fok: tiltó szöveg, kritikus jelölés, spot-név a címben", () => {
    const payload = buildStormPushPayload(0, 2, [SPOTS[0]!], OPTIONS);
    expect(payload.title).toBe("II. fokú viharjelzés — Balatonföldvár");
    expect(payload.body).toContain("Tilos a vízen tartózkodni");
    expect(payload.body).toContain("azonnali partraszállás");
    expect(payload.critical).toBe(true);
    expect(payload.url).toBe("/spotok/balatonfoldvar");
  });

  it("I. fok: óvatosságra intő szöveg", () => {
    const payload = buildStormPushPayload(0, 1, [SPOTS[0]!], OPTIONS);
    expect(payload.title).toContain("I. fokú viharjelzés");
    expect(payload.title).not.toContain("II.");
    expect(payload.body).toContain("Fokozott óvatosság");
    expect(payload.critical).toBe(true);
  });

  it("visszaállás: Újra evezhető — a korábbi fok megnevezésével, nem kritikus", () => {
    const payload = buildStormPushPayload(2, 0, [SPOTS[0]!], OPTIONS);
    expect(payload.title).toBe("Újra evezhető — Balatonföldvár");
    expect(payload.body).toContain("II. fok");
    expect(payload.critical).toBeUndefined();
  });

  it("MINDEN üzenetben szerepel a forrás és az időbélyeg (9./4.)", () => {
    for (const [from, to] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ] as const) {
      const payload = buildStormPushPayload(from, to, [SPOTS[0]!], OPTIONS);
      expect(payload.body).toContain("met.hu / BM OKF");
      expect(payload.body).toMatch(/\d{1,2}:\d{2}/);
    }
  });

  it("több spotnál a lista-oldalra mutat, és azonos tag-et ad (felülírás)", () => {
    const a = buildStormPushPayload(0, 2, [SPOTS[0]!, SPOTS[1]!], OPTIONS);
    const b = buildStormPushPayload(2, 0, [SPOTS[1]!, SPOTS[0]!], OPTIONS);
    expect(a.url).toBe("/spotok");
    expect(a.tag).toBe(b.tag); // sorrend-független
  });
});

describe("buildStormPushTargets", () => {
  const change = { from: 0, to: 2 } as const;

  it("csak a feliratkozott spotokra szabott üzenetet ad", () => {
    const targets = buildStormPushTargets(
      change,
      SPOTS,
      [sub({ id: "a", alert_spot_ids: ["s1"] }), sub({ id: "b", alert_spot_ids: ["s2", "s3"] })],
      OPTIONS,
    );
    expect(targets.map((t) => t.subscriptionId)).toEqual(["a", "b"]);
    expect(targets[0]!.payload.title).toContain("Balatonföldvár");
    expect(targets[0]!.payload.title).not.toContain("Siófok");
    expect(targets[1]!.payload.title).toContain("Siófok, Tihany");
  });

  it("kihagyja azt, akinek egy érintett spot sem szerepel a listáján", () => {
    const targets = buildStormPushTargets(
      change,
      SPOTS,
      [sub({ alert_spot_ids: ["masik-spot"] })],
      OPTIONS,
    );
    expect(targets).toEqual([]);
  });

  it("a spot nélküli (null/üres) feliratkozás NEM kap riasztást — explicit opt-in", () => {
    const targets = buildStormPushTargets(
      change,
      SPOTS,
      [sub({ id: "n", alert_spot_ids: null }), sub({ id: "e", alert_spot_ids: [] })],
      OPTIONS,
    );
    expect(targets).toEqual([]);
  });

  it("kihagyja a nem-webpush platformot és a hibás tokent", () => {
    const targets = buildStormPushTargets(
      change,
      SPOTS,
      [
        sub({ id: "fcm", platform: "fcm" }),
        sub({ id: "rossz", token: { endpoint: "https://e" } }),
      ],
      OPTIONS,
    );
    expect(targets).toEqual([]);
  });
});
