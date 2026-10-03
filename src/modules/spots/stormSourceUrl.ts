/**
 * Hivatalos viharjelzés-forrás URL-je a spot `storm_warning_region`-jéhez —
 * az elavult (stale) viharjelzés-figyelmeztetés mutat ide, hogy a felhasználó
 * az indulás előtt a HIVATALOS oldalon ellenőrizze az aktuális állapotot
 * (lásd `StormAlertStaleBanner`).
 *
 * A linkek köre SZÁNDÉKOSAN duplikált az Edge Function oldali
 * `supabase/functions/_shared/storm-scrape.ts` `DEFAULT_STORM_SOURCES`-ével
 * (ugyanazok a met.hu / LSZ oldalak) — a `supabase/functions` Deno-runtime
 * kód, a webes SSR-bundle nem importálhat belőle (1.3 modul-szerződés: a
 * weboldal csak a saját modulján és a core-on át függhet; az Edge Function
 * nem modul és nem core). A 4 régió stabil (lásd a README "Viharjelzés-forrás"
 * szakaszát); ha változik, mindkét helyen frissítendő.
 */

const REGION_SOURCE_URL: Readonly<Record<string, string>> = {
  Balaton: "https://www.met.hu/idojaras/tavaink/balaton/viharjelzes/main.php",
  "Velencei-tó": "https://www.met.hu/idojaras/tavaink/velencei-to/viharjelzes/main.php",
  "Tisza-tó": "https://www.met.hu/idojaras/tavaink/tisza-to/viharjelzes/main.php",
  // Burgenlandi Landessicherheitszentrale — lásd a README "Fertő —
  // burgenlandi (LSZ) forrás" szakaszát.
  Fertő: "https://www.lsz-b.at/fuer-buergerinnen/sturmwarnung-webcams/",
};

/** Ha a spotnak nincs ismert régiója (pl. folyó/árvíz), ez az általános link. */
export const GENERAL_STORM_SOURCE_URL = "https://www.met.hu/idojaras/tavaink/";

/**
 * A spot `storm_warning_region` mezőjéhez tartozó hivatalos forrás-URL, vagy
 * az általános met.hu tavaink-oldal, ha a régió ismeretlen/hiányzik (pl. a
 * figyelmeztetés folyó-árvíz miatt jött, ahol nincs tavankénti viharjelzés).
 */
export function officialStormSourceUrl(stormWarningRegion: string | null): string {
  if (!stormWarningRegion) return GENERAL_STORM_SOURCE_URL;
  return REGION_SOURCE_URL[stormWarningRegion] ?? GENERAL_STORM_SOURCE_URL;
}
