/**
 * Viharjelzés-push: célzás + üzenet-építés (F1.9, 9. fejezet 2–4. pont).
 *
 * TISZTA logika — se hálózat, se DB. A `_shared` szerződés szerint Deno- és
 * Node-semleges, ezért Vitesttel tesztelhető.
 *
 * NYELV: a szöveg itt magyarul épül. Az Edge Function nem éri el az i18next
 * namespace-eket (a webes bundle része), és F1-ben csak a `hu` locale él
 * (activeLocales, F1.8). Több nyelvnél a feliratkozás locale-ját is tárolni
 * kell majd (F2) — a payload-építő addig is egyetlen pont, ahol a szöveg van.
 */
import type { StormLevelChange } from "./storm-scrape.ts";
import type { StormLevel } from "./types.ts";
import type { WebPushPayload, WebPushSubscription } from "./web-push.ts";

/** Egy `push_subscriptions` sor (a küldéshez szükséges részhalmaz). */
export interface PushSubscriptionRow {
  id: string;
  platform: string;
  /** jsonb — webpushnál `{ endpoint, keys: { p256dh, auth } }`. */
  token: unknown;
  /** Mely spotokra kért a felhasználó viharriasztást (explicit opt-in). */
  alert_spot_ids: string[] | null;
}

/** Egy riasztásban érintett spot azonosítója + megjelenítendő neve/útvonala. */
export interface AffectedSpot {
  spotId: string;
  name: string;
  /** A spot publikus útvonala (`/spotok/<slug>`), ha ismert. */
  path?: string;
}

/** Egy konkrét küldendő üzenet: kinek (feliratkozás) és mit (payload). */
export interface PushTarget {
  subscriptionId: string;
  subscription: WebPushSubscription;
  payload: WebPushPayload;
}

/**
 * jsonb token → web push feliratkozás. Tolerálja a lapos (`{endpoint, p256dh,
 * auth}`) és a böngésző natív (`{endpoint, keys:{...}}`) alakot is; bármi más
 * (hiányzó mező, fcm/apns platform) null → a sor kimarad a küldésből.
 */
export function parseWebPushToken(token: unknown): WebPushSubscription | null {
  if (typeof token !== "object" || token === null) return null;
  const raw = token as Record<string, unknown>;
  const keys = (typeof raw.keys === "object" && raw.keys !== null
    ? (raw.keys as Record<string, unknown>)
    : raw) as Record<string, unknown>;

  const endpoint = raw.endpoint;
  const p256dh = keys.p256dh;
  const auth = keys.auth;
  if (typeof endpoint !== "string" || endpoint === "") return null;
  if (typeof p256dh !== "string" || p256dh === "") return null;
  if (typeof auth !== "string" || auth === "") return null;
  return { endpoint, p256dh, auth };
}

/** Budapesti helyi idő `ÓÓ:PP` alakban; ICU hiányában UTC-re esik vissza. */
export function formatTimestamp(when: Date): string {
  try {
    return new Intl.DateTimeFormat("hu-HU", {
      timeZone: "Europe/Budapest",
      hour: "2-digit",
      minute: "2-digit",
    }).format(when);
  } catch {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())} UTC`;
  }
}

/** Spot-nevek felsorolása (max 3 + „és még N"). */
export function formatSpotNames(names: readonly string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} és még ${names.length - 3}`;
}

export interface StormPushOptions {
  /** A scrape ideje — MINDEN üzenetben szerepel (9./4. és 2. fejezet 5.). */
  now: Date;
  /** Forrás-megjelölés (9./4.), pl. „met.hu / BM OKF". */
  source: string;
}

/**
 * A 9./3. pont szerinti üzenet. II. fok = tiltás + azonnali partraszállás;
 * I. fok = fokozott óvatosság; visszaállás (>=1 → 0) = „Újra evezhető".
 * Minden üzenet végén forrás + időbélyeg.
 */
export function buildStormPushPayload(
  from: StormLevel,
  to: StormLevel,
  spots: readonly AffectedSpot[],
  options: StormPushOptions,
): WebPushPayload {
  const names = formatSpotNames(spots.map((s) => s.name));
  const footer = `Forrás: ${options.source} · ${formatTimestamp(options.now)}`;
  const url = spots.length === 1 && spots[0]?.path ? spots[0].path : "/spotok";
  // Azonos tag → az új riasztás FELÜLÍRJA a korábbit ugyanarra a spot-körre
  // (nem gyűlnek a félrevezető, elavult értesítések — 2. fejezet 5. szabály).
  const tag = `storm:${spots.map((s) => s.spotId).sort().join(",")}`;

  if (to === 2) {
    return {
      title: `II. fokú viharjelzés — ${names}`,
      body: `Tilos a vízen tartózkodni — azonnali partraszállás! ${footer}`,
      url,
      tag,
      critical: true,
    };
  }
  if (to === 1) {
    return {
      title: `I. fokú viharjelzés — ${names}`,
      body: `Fokozott óvatosság: a viharjelző rendszer I. fokon van. Maradj a part közelében! ${footer}`,
      url,
      tag,
      critical: true,
    };
  }
  return {
    title: `Újra evezhető — ${names}`,
    body: `A viharjelzés feloldva (korábban ${from === 2 ? "II." : "I."} fok). Indulás előtt nézd meg az aktuális SUP-indexet. ${footer}`,
    url,
    tag,
  };
}

/**
 * Egy körzet-szintváltáshoz tartozó küldendő üzenetek. Egy feliratkozó CSAK
 * azokat a spotokat kapja, amelyekre EXPLICIT feliratkozott (`alert_spot_ids`
 * metszete az érintett spotokkal); spot nélküli sor nem kap semmit.
 * Feliratkozásonként EGY üzenet készül, a saját spotjaira szabott szöveggel.
 */
export function buildStormPushTargets(
  change: Pick<StormLevelChange, "from" | "to">,
  affectedSpots: readonly AffectedSpot[],
  subscriptions: readonly PushSubscriptionRow[],
  options: StormPushOptions,
): PushTarget[] {
  const byId = new Map(affectedSpots.map((s) => [s.spotId, s]));
  const targets: PushTarget[] = [];

  for (const row of subscriptions) {
    if (row.platform !== "webpush") continue;
    const subscription = parseWebPushToken(row.token);
    if (!subscription) continue;

    const own = (row.alert_spot_ids ?? [])
      .map((id) => byId.get(id))
      .filter((s): s is AffectedSpot => s !== undefined);
    if (own.length === 0) continue;

    targets.push({
      subscriptionId: row.id,
      subscription,
      payload: buildStormPushPayload(change.from, change.to, own, options),
    });
  }

  return targets;
}
