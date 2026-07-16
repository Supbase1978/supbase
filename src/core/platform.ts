/**
 * Platform-absztrakció (FEJLESZTESI_DOKUMENTACIO 1.2): a kód nem tudhatja
 * build-időben, melyik célra megy (SSR web vagy Capacitor natív). Minden
 * platform-különbség (push-regisztráció, offline térkép, fájlrendszer)
 * kizárólag ezen a modulon keresztül kezelhető.
 */

export type Platform = "web" | "ios" | "android";

/** Futásidejű detektálás — F2-ben a Capacitor.getPlatform() kerül ide. */
export function getPlatform(): Platform {
  return "web";
}

export function isNative(): boolean {
  return getPlatform() !== "web";
}
