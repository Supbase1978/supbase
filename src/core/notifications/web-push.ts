/**
 * Web Push provider (F1.9, 9. fejezet) — VAPID + service worker.
 *
 * FELELŐSSÉG-HATÁR: ez a réteg CSAK a böngésző-oldali feliratkozást intézi
 * (engedélykérés, SW-regisztráció, PushManager). A `push_subscriptions` táblát
 * SOHA nem írja közvetlenül: a feliratkozás JSON-ját a `/api/push` resource
 * route-nak küldi, ami a szerver-oldali (cookie-s) sessionnel, RLS alatt írja
 * az adatbázist. Így a kliens-bundle-be nem kerül DB-írás-logika, és a
 * jogosultság-ellenőrzés egy helyen (szerver) marad.
 */
import type {
  NotificationProvider,
  NotificationSubscription,
  NotificationTopic,
} from "./types";

/** A böngésző natív feliratkozás-JSON-ja (a szerver ezt tárolja tokenként). */
export interface BrowserPushToken {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** A `/api/push` GET-válasza: az AKTUÁLIS eszköz feliratkozásai. */
export interface PushStatusResponse {
  subscriptions: NotificationSubscription[];
}

export const PUSH_API_PATH = "/api/push";

/** A VAPID publikus kulcs (publikus érték — bekerülhet a kliens-bundle-be). */
export function getVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  return typeof key === "string" && key !== "" ? key : null;
}

/** base64url → bájtok (a PushManager `applicationServerKey`-hez). */
export function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url + "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A böngésző-feliratkozásból a szervernek küldendő token. */
export function toBrowserPushToken(subscription: PushSubscription): BrowserPushToken {
  const json = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("A böngésző hiányos push-feliratkozást adott vissza.");
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

/** Az értesítési engedély állapota SSR-biztosan (szerveren "unsupported"). */
export type PushPermission = "unsupported" | "default" | "granted" | "denied";

export class WebPushProvider implements NotificationProvider {
  isSupported(): boolean {
    if (typeof navigator === "undefined" || typeof window === "undefined") {
      // SSR-en (Node) nincs navigator/window — biztonságosan "nem támogatott".
      return false;
    }
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  getPermission(): PushPermission {
    if (!this.isSupported()) return "unsupported";
    return Notification.permission as PushPermission;
  }

  /** SW-regisztráció igény szerint (nem minden oldalbetöltésnél). */
  private async ready(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return await navigator.serviceWorker.ready;
  }

  /**
   * Engedélykérés + PushManager-feliratkozás. Meglévő feliratkozást újrahasznál
   * (a böngésző ugyanazt az endpointot adja vissza).
   */
  async ensureBrowserSubscription(): Promise<BrowserPushToken> {
    if (!this.isSupported()) {
      throw new Error("push.unsupported");
    }
    const vapidPublicKey = getVapidPublicKey();
    if (!vapidPublicKey) {
      throw new Error("push.notConfigured");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("push.denied");
    }

    const registration = await this.ready();
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    return toBrowserPushToken(subscription);
  }

  private async post(body: Record<string, string>): Promise<void> {
    const response = await fetch(PUSH_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(detail?.error ?? "push.saveFailed");
    }
  }

  async subscribe(topic: NotificationTopic): Promise<void> {
    const token = await this.ensureBrowserSubscription();
    await this.post({ intent: "subscribe", topic, token: JSON.stringify(token) });
  }

  async unsubscribe(topic: NotificationTopic): Promise<void> {
    if (!this.isSupported()) throw new Error("push.unsupported");
    const registration = await this.ready();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await this.post({
      intent: "unsubscribe",
      topic,
      endpoint: subscription.endpoint,
    });
  }

  /** Az AKTUÁLIS eszköz feliratkozásai (a szerver az endpoint alapján adja). */
  async getSubscriptions(): Promise<NotificationSubscription[]> {
    if (!this.isSupported()) return [];
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return [];

    const response = await fetch(
      `${PUSH_API_PATH}?endpoint=${encodeURIComponent(subscription.endpoint)}`,
    );
    if (!response.ok) return [];
    const data = (await response.json()) as PushStatusResponse;
    return data.subscriptions ?? [];
  }
}
