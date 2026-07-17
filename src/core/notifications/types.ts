/**
 * Push-értesítés absztrakció (FEJLESZTESI_DOKUMENTACIO 9. fejezet).
 * F1: Web Push (VAPID, service worker). F2: Capacitor FCM/APNs — ugyanezen
 * interfész mögé, platform.ts alapján választva (lásd `./index.ts`).
 */

/** Viharjelzés-riasztási topic egy spot `storm_warning_region`-jéhez. */
export type StormTopic = `storm:${string}`;

/**
 * Bővíthető topic-uniió — F2+-ban ide kerülnek az egyéb push-típusok
 * (pl. "Értesíts, ha újra evezhető", árfigyelő, review-válasz — 9. fejezet
 * "Egyéb push" pont).
 */
export type NotificationTopic = StormTopic;

/** Segéd a típusos storm-topic előállításához. */
export function stormTopic(regionId: string): StormTopic {
  return `storm:${regionId}`;
}

export interface NotificationSubscription {
  topic: NotificationTopic;
  createdAt: string;
}

export interface NotificationProvider {
  subscribe(topic: NotificationTopic): Promise<void>;
  unsubscribe(topic: NotificationTopic): Promise<void>;
  getSubscriptions(): Promise<NotificationSubscription[]>;
  /** Támogatja-e a jelenlegi futásidejű környezet a push-értesítést. */
  isSupported(): boolean;
}
