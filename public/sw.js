/*
 * Suptime — service worker (F1.9, 9. fejezet).
 *
 * Kizárólag a push-értesítéseket kezeli. SZÁNDÉKOSAN NINCS benne fetch-handler
 * és offline cache: a viharjelzés biztonságkritikus, és egy cache-elt riasztás
 * SOHA nem jelenhet meg aktuálisként (2. fejezet 5. szabály). Az offline-réteg
 * (TanStack Query persist, explicit „elavult" jelzéssel) külön feladat.
 *
 * Nyers JS, nem megy át a bundleren — a böngésző így, ahogy van, futtatja.
 */

self.addEventListener("install", () => {
  // Azonnal átveszi a helyét (nincs mit előtölteni).
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Suptime";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    lang: "hu",
    // Azonos tag → az új riasztás FELÜLÍRJA a korábbit ugyanarra a spot-körre,
    // hogy ne torlódjanak az elavult üzenetek.
    tag: data.tag || "sup-platform",
    renotify: Boolean(data.tag),
    // II./I. fokú riasztásnál marad a képernyőn, amíg a felhasználó nem zárja.
    requireInteraction: Boolean(data.critical),
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client && "navigate" in client) {
            return client.focus().then((focused) => focused.navigate(target));
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});

/*
 * A böngésző időnként lecseréli a push-feliratkozást (kulcsrotáció). Ilyenkor
 * a régi endpoint elhal — a szerver a 410-es válaszból takarítja. Az újat a
 * felhasználó következő látogatásakor a PushToggle regisztrálja újra.
 */
self.addEventListener("pushsubscriptionchange", () => {
  // Az újrafeliratkozáshoz bejelentkezett session kell, ami itt nem elérhető.
});
