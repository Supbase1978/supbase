/**
 * Playwright global setup — a dev-szerver BEMELEGÍTÉSE a tesztek előtt.
 *
 * MIÉRT KELL: a Vite a függőségeket az ELSŐ oldalbetöltéskor optimalizálja
 * (nem indításkor), és közben újratölti a lapot. A `webServer.url` health-check
 * ezt nem várja meg, így a párhuzamos tesztek egy épp újrainduló szerverbe
 * futnak — lokálisan is láttunk emiatt 9 db `page.goto` timeoutot, holott a
 * kód hibátlan volt. CI-ban ez véletlenszerű pirosat adna.
 *
 * A megoldás determinisztikus: sorban egyszer meghívjuk a nehéz route-okat
 * (ezek húzzák be a maplibre-gl / supabase / i18next csomagokat), és csak
 * utána indulnak a tesztek.
 */
import type { FullConfig } from "@playwright/test";

/** A legtöbb kliens-függőséget behúzó útvonalak. */
const WARMUP_PATHS = ["/", "/deszkak", "/spotok", "/szolgaltatok", "/deszkavalaszto", "/belepes"];

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:5173";

  for (const path of WARMUP_PATHS) {
    try {
      // Szándékosan SOROSAN: a Vite dep-optimalizálás párhuzamos kérésekre
      // többször is újraindulhat.
      const response = await fetch(new URL(path, baseURL), {
        signal: AbortSignal.timeout(60_000),
      });
      await response.text();
    } catch (error) {
      // A bemelegítés best-effort: ha egy útvonal hibázik, a teszt úgyis
      // elbukik majd — beszédesebb hibaüzenettel, mint egy setup-crash.
      console.warn(`[e2e warmup] ${path}: ${String(error)}`);
    }
  }
}
