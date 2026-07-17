/**
 * Web Push implementáció váza (F1). A `isSupported()` valós, SSR-safe
 * futásidejű ellenőrzés; a feliratkozás-kezelő metódusok F1.9-ig
 * `NotImplemented`-hibát dobnak — a VAPID-kulcsos service worker
 * regisztráció és a `push_subscriptions` tábla bekötése ott készül el.
 */
import type {
  NotificationProvider,
  NotificationSubscription,
  NotificationTopic,
} from "./types";

export class WebPushProvider implements NotificationProvider {
  isSupported(): boolean {
    if (typeof navigator === "undefined" || typeof window === "undefined") {
      // SSR-en (Node) nincs navigator/window — biztonságosan "nem támogatott".
      return false;
    }
    return "serviceWorker" in navigator && "PushManager" in window;
  }

  subscribe(topic: NotificationTopic): Promise<void> {
    return Promise.reject(
      new Error(
        `WebPushProvider.subscribe("${topic}"): még nincs implementálva — a VAPID/service worker bekötés az F1.9 feladatban készül el.`,
      ),
    );
  }

  unsubscribe(topic: NotificationTopic): Promise<void> {
    return Promise.reject(
      new Error(
        `WebPushProvider.unsubscribe("${topic}"): még nincs implementálva — F1.9-ben érkezik.`,
      ),
    );
  }

  getSubscriptions(): Promise<NotificationSubscription[]> {
    return Promise.reject(
      new Error(
        "WebPushProvider.getSubscriptions: még nincs implementálva — F1.9-ben érkezik.",
      ),
    );
  }
}
