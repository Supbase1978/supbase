/**
 * Provider-választó a platform.ts alapján (FEJLESZTESI_DOKUMENTACIO 9. fejezet).
 * A kód nem tudhatja build-időben, melyik célra megy — a platform-eldöntést
 * kizárólag ez a fájl végzi.
 */
import { getPlatform } from "@core/platform";

import type { NotificationProvider } from "./types";
import { WebPushProvider } from "./web-push";

export type {
  NotificationProvider,
  NotificationSubscription,
  NotificationTopic,
  StormTopic,
} from "./types";
export { stormTopic } from "./types";
export { WebPushProvider } from "./web-push";

export function getNotificationProvider(): NotificationProvider {
  const platform = getPlatform();

  switch (platform) {
    case "web":
      return new WebPushProvider();
    case "ios":
    case "android":
      // F2: Capacitor FCM/APNs implementáció (natív push-plugin bekötése).
      throw new Error(
        `getNotificationProvider: a(z) "${platform}" platform push-implementációja az F2 (Capacitor) fázisban készül el.`,
      );
    default: {
      const exhaustiveCheck: never = platform;
      throw new Error(`getNotificationProvider: ismeretlen platform: ${String(exhaustiveCheck)}`);
    }
  }
}
