/**
 * push.server tesztek — a topic-validálás és a spot-lista összefésülése.
 * A topic a KLIENSRŐL jön, ezért a validálás biztonsági kérdés; a
 * feliratkozás-frissítés pedig nem veszíthet el korábbi spotokat.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  addSpotId,
  parseBrowserPushToken,
  parseStormTopic,
  removeSpotId,
  subscribeToSpot,
  toStormTopics,
  unsubscribeFromSpot,
  type BrowserPushToken,
} from "./push.server";

const SPOT_A = "11111111-2222-3333-4444-555555555555";
const SPOT_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const TOKEN: BrowserPushToken = {
  endpoint: "https://push.example/abc",
  keys: { p256dh: "PUB", auth: "AUTH" },
};

interface Row {
  id: string;
  alert_spot_ids: string[] | null;
  created_at: string;
}

/** Minimális Supabase-kliens-dublőr: csak amit ezek a helperek hívnak. */
function fakeSupabase(row: Row | null) {
  const calls = {
    rpc: [] as { name: string; args: Record<string, unknown> }[],
    deleted: [] as string[],
    updated: [] as { values: Record<string, unknown>; endpoint: string }[],
  };
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }),
      }),
      delete: () => ({
        eq: (_column: string, value: string) => {
          calls.deleted.push(value);
          return Promise.resolve({ error: null });
        },
      }),
      update: (values: Record<string, unknown>) => ({
        eq: (_column: string, value: string) => {
          calls.updated.push({ values, endpoint: value });
          return Promise.resolve({ error: null });
        },
      }),
    }),
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.rpc.push({ name, args });
      return Promise.resolve({ error: null });
    },
  };
  return { supabase: client as unknown as SupabaseClient, calls };
}

describe("parseStormTopic", () => {
  it("kibontja a spot-azonosítót", () => {
    expect(parseStormTopic(`storm:${SPOT_A}`)).toBe(SPOT_A);
  });

  it("kisbetűsít (uuid-normalizálás)", () => {
    expect(parseStormTopic(`storm:${SPOT_A.toUpperCase()}`)).toBe(SPOT_A);
  });

  it.each([
    ["idegen prefix", `alert:${SPOT_A}`],
    ["prefix nélkül", SPOT_A],
    ["nem uuid", "storm:nem-uuid"],
    ["üres", "storm:"],
    ["SQL-szerű bemenet", "storm:' or 1=1--"],
  ])("null-t ad érvénytelen topicra (%s)", (_label, topic) => {
    expect(parseStormTopic(topic)).toBeNull();
  });
});

describe("toStormTopics", () => {
  it("spot-azonosítókból topicokat képez", () => {
    expect(toStormTopics([SPOT_A, SPOT_B])).toEqual([
      `storm:${SPOT_A}`,
      `storm:${SPOT_B}`,
    ]);
  });
});

describe("addSpotId / removeSpotId", () => {
  it("hozzáad, de nem duplikál", () => {
    expect(addSpotId([SPOT_A], SPOT_B)).toEqual([SPOT_A, SPOT_B]);
    expect(addSpotId([SPOT_A], SPOT_A)).toEqual([SPOT_A]);
  });

  it("eltávolít, idempotensen", () => {
    expect(removeSpotId([SPOT_A, SPOT_B], SPOT_A)).toEqual([SPOT_B]);
    expect(removeSpotId([SPOT_B], SPOT_A)).toEqual([SPOT_B]);
  });
});

describe("parseBrowserPushToken", () => {
  it("elfogadja a szabályos tokent", () => {
    expect(parseBrowserPushToken(TOKEN)).toEqual(TOKEN);
  });

  it.each([
    ["null", null],
    ["string", "token"],
    ["nem https endpoint", { endpoint: "http://push.example/a", keys: { p256dh: "P", auth: "A" } }],
    ["hiányzó kulcs", { endpoint: "https://push.example/a", keys: { p256dh: "P" } }],
    ["üres kulcs", { endpoint: "https://push.example/a", keys: { p256dh: "", auth: "A" } }],
  ])("elutasítja (%s)", (_label, raw) => {
    expect(parseBrowserPushToken(raw)).toBeNull();
  });
});

describe("subscribeToSpot", () => {
  it("meglévő feliratkozás mellé fűzi az új spotot (nem veszít el spotot)", async () => {
    const { supabase, calls } = fakeSupabase({
      id: "s1",
      alert_spot_ids: [SPOT_A],
      created_at: "2026-07-24T10:00:00Z",
    });
    const result = await subscribeToSpot(supabase, TOKEN, SPOT_B);

    expect(result.ok).toBe(true);
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0]!.name).toBe("upsert_push_subscription");
    expect(calls.rpc[0]!.args).toEqual({
      p_token: TOKEN,
      p_spot_ids: [SPOT_A, SPOT_B],
    });
  });

  it("első feliratkozásnál egyelemű listát ír", async () => {
    const { supabase, calls } = fakeSupabase(null);
    await subscribeToSpot(supabase, TOKEN, SPOT_A);
    expect(calls.rpc[0]!.args.p_spot_ids).toEqual([SPOT_A]);
  });
});

describe("unsubscribeFromSpot", () => {
  it("a maradék spotokkal frissít, ha marad feliratkozás", async () => {
    const { supabase, calls } = fakeSupabase({
      id: "s1",
      alert_spot_ids: [SPOT_A, SPOT_B],
      created_at: "2026-07-24T10:00:00Z",
    });
    const result = await unsubscribeFromSpot(supabase, TOKEN.endpoint, SPOT_A);

    expect(result.ok).toBe(true);
    expect(calls.deleted).toEqual([]);
    expect(calls.updated).toHaveLength(1);
    expect(calls.updated[0]!.values.alert_spot_ids).toEqual([SPOT_B]);
    expect(calls.updated[0]!.endpoint).toBe(TOKEN.endpoint);
  });

  it("az utolsó spot leiratkozásakor TÖRLI a sort (adatminimum)", async () => {
    const { supabase, calls } = fakeSupabase({
      id: "s1",
      alert_spot_ids: [SPOT_A],
      created_at: "2026-07-24T10:00:00Z",
    });
    await unsubscribeFromSpot(supabase, TOKEN.endpoint, SPOT_A);

    expect(calls.deleted).toEqual([TOKEN.endpoint]);
    expect(calls.updated).toEqual([]);
  });

  it("nem létező feliratkozásnál sikerrel tér vissza, írás nélkül", async () => {
    const { supabase, calls } = fakeSupabase(null);
    const result = await unsubscribeFromSpot(supabase, TOKEN.endpoint, SPOT_A);

    expect(result.ok).toBe(true);
    expect(calls.deleted).toEqual([]);
    expect(calls.updated).toEqual([]);
  });
});
