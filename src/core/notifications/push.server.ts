/**
 * Push-feliratkozás szerver-helperek (F1.9). A `push_subscriptions` táblát
 * kizárólag INNEN írjuk — a böngésző a `/api/push` route-on át hív, a klienst
 * (cookie-s SSR-session) a route adja át, így minden írás RLS alatt fut.
 *
 * Az ÍRÁS az `upsert_push_subscription()` SECURITY DEFINER RPC-n megy: az
 * eszköz-átvételhez (ugyanaz a böngésző-endpoint másik fiókkal) más felhasználó
 * sorát kell törölni, amit RLS alatt a hívó nem tehetne meg. A user_id-t az RPC
 * az `auth.uid()`-ból veszi — paraméterből SOHA.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { stormTopic, type NotificationSubscription, type StormTopic } from "./types";

/** A böngésző natív feliratkozás-JSON-ja (a `token` jsonb tartalma). */
export interface BrowserPushToken {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `storm:<spot-uuid>` → spot-azonosító. Minden más (idegen prefix, nem-uuid)
 * null — a topic a kliensről jön, ezért nem megbízható bemenet.
 */
export function parseStormTopic(topic: string): string | null {
  if (!topic.startsWith("storm:")) return null;
  const spotId = topic.slice("storm:".length);
  return UUID_RE.test(spotId) ? spotId.toLowerCase() : null;
}

/** Spot-azonosítók → topicok (a kliens ezt kapja vissza). */
export function toStormTopics(spotIds: readonly string[]): StormTopic[] {
  return spotIds.map((id) => stormTopic(id));
}

/** Hozzáadás duplikátum nélkül, sorrend-stabilan. */
export function addSpotId(current: readonly string[], spotId: string): string[] {
  return current.includes(spotId) ? [...current] : [...current, spotId];
}

/** Eltávolítás (idempotens). */
export function removeSpotId(current: readonly string[], spotId: string): string[] {
  return current.filter((id) => id !== spotId);
}

/** A kliensről érkező token szerkezeti validálása (nem bízunk a bemenetben). */
export function parseBrowserPushToken(raw: unknown): BrowserPushToken | null {
  if (typeof raw !== "object" || raw === null) return null;
  const token = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const { endpoint, keys } = token;
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint)) return null;
  if (typeof keys?.p256dh !== "string" || keys.p256dh === "") return null;
  if (typeof keys.auth !== "string" || keys.auth === "") return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

interface SubscriptionRow {
  id: string;
  alert_spot_ids: string[] | null;
  created_at: string;
}

/**
 * Az AKTUÁLIS eszköz (endpoint) feliratkozása a bejelentkezett usernél.
 * RLS: a saját sorain kívül nem lát semmit, ezért az endpoint-szűrő elég.
 */
export async function getSubscriptionByEndpoint(
  supabase: SupabaseClient,
  endpoint: string,
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, alert_spot_ids, created_at")
    .eq("endpoint", endpoint)
    .maybeSingle<SubscriptionRow>();
  return error ? null : (data ?? null);
}

/** Az eszköz feliratkozásai `NotificationSubscription` alakban (GET /api/push). */
export async function listDeviceSubscriptions(
  supabase: SupabaseClient,
  endpoint: string,
): Promise<NotificationSubscription[]> {
  const row = await getSubscriptionByEndpoint(supabase, endpoint);
  if (!row) return [];
  return toStormTopics(row.alert_spot_ids ?? []).map((topic) => ({
    topic,
    createdAt: row.created_at,
  }));
}

/**
 * Feliratkozás egy spot viharjelzésére. A meglévő spot-listát BŐVÍTI (az eszköz
 * több spotra is feliratkozhat), majd az RPC-vel ír.
 */
export async function subscribeToSpot(
  supabase: SupabaseClient,
  token: BrowserPushToken,
  spotId: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await getSubscriptionByEndpoint(supabase, token.endpoint);
  const spotIds = addSpotId(existing?.alert_spot_ids ?? [], spotId);

  const { error } = await supabase.rpc("upsert_push_subscription", {
    p_token: token,
    p_spot_ids: spotIds,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Leiratkozás egy spotról. Ha ezzel elfogyott a lista, a SOR IS TÖRLŐDIK —
 * spot nélküli feliratkozás nem kap riasztást, felesleges tárolni (adatminimum).
 */
export async function unsubscribeFromSpot(
  supabase: SupabaseClient,
  endpoint: string,
  spotId: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await getSubscriptionByEndpoint(supabase, endpoint);
  if (!existing) return { ok: true };

  const spotIds = removeSpotId(existing.alert_spot_ids ?? [], spotId);

  const { error } =
    spotIds.length === 0
      ? await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)
      : await supabase
          .from("push_subscriptions")
          .update({ alert_spot_ids: spotIds, updated_at: new Date().toISOString() })
          .eq("endpoint", endpoint);

  return error ? { ok: false, error: error.message } : { ok: true };
}
