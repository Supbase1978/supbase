/**
 * `/api/push` — a böngésző-oldali push-feliratkozás szerver-vége (F1.9).
 *
 * Resource route (nincs komponens): a `WebPushProvider` hívja fetch-csel.
 * A `push_subscriptions` írás KIZÁRÓLAG itt történik, a kérés cookie-s
 * SSR-sessionjével, RLS alatt — a kliens-bundle-be nem kerül DB-logika.
 *
 * GET  ?endpoint=…  → az adott eszköz feliratkozásai (topic-lista).
 * POST { intent: "subscribe" | "unsubscribe", topic, token | endpoint }.
 *
 * Bejelentkezés nélkül 401 JSON (NEM redirect — ez API-végpont).
 */
import { getUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import {
  listDeviceSubscriptions,
  parseBrowserPushToken,
  parseStormTopic,
  subscribeToSpot,
  unsubscribeFromSpot,
} from "@core/notifications/push.server";

import type { Route } from "./+types/api.push";

function json(body: unknown, status = 200, extraHeaders?: Headers): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) return json({ subscriptions: [] });

  const user = await getUser(request);
  if (!user) return json({ subscriptions: [] });

  const { supabase } = createSupabaseServerClient(request);
  return json({ subscriptions: await listDeviceSubscriptions(supabase, endpoint) });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return json({ error: "push.methodNotAllowed" }, 405);
  }

  const user = await getUser(request);
  if (!user) return json({ error: "push.loginRequired" }, 401);

  const body = (await request.json().catch(() => null)) as {
    intent?: string;
    topic?: string;
    token?: string;
    endpoint?: string;
  } | null;
  if (!body) return json({ error: "push.badRequest" }, 400);

  // A topic a kliensről jön → sosem megbízható: uuid-alakra validálva.
  const spotId = body.topic ? parseStormTopic(body.topic) : null;
  if (!spotId) return json({ error: "push.badTopic" }, 400);

  const { supabase, headers } = createSupabaseServerClient(request);

  if (body.intent === "subscribe") {
    const token = parseBrowserPushToken(
      typeof body.token === "string" ? safeJsonParse(body.token) : body.token,
    );
    if (!token) return json({ error: "push.badToken" }, 400, headers);

    const result = await subscribeToSpot(supabase, token, spotId);
    return result.ok
      ? json({ ok: true }, 200, headers)
      : json({ error: "push.saveFailed" }, 500, headers);
  }

  if (body.intent === "unsubscribe") {
    if (!body.endpoint) return json({ error: "push.badRequest" }, 400, headers);
    const result = await unsubscribeFromSpot(supabase, body.endpoint, spotId);
    return result.ok
      ? json({ ok: true }, 200, headers)
      : json({ error: "push.saveFailed" }, 500, headers);
  }

  return json({ error: "push.badRequest" }, 400, headers);
}
