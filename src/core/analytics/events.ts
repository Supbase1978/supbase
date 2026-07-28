/**
 * Eseménynevek — EGYETLEN forrás (a DB-kényszer és az RPC ugyanezt a listát
 * ismeri; eltérés esetén a DB csendben eldobja az ismeretlen nevet).
 *
 * Az esemény-készlet SZŰK marad: minden új név külön döntés, mert a
 * mérés-adósság ugyanolyan teher, mint a kódadósság — a soha meg nem nézett
 * események csak zajt adnak.
 */
export const ANALYTICS_EVENTS = [
  /** Publikus oldal megtekintése (lista/adatlap). */
  "page_view",
  /** A deszkaválasztó kérdőíve jelent meg (tölcsér eleje). */
  "advisor_wizard_view",
  /** Ajánlás-eredmény jelent meg (tölcsér vége — megosztott linkből is). */
  "advisor_result_view",
  /** A kérdőívet ténylegesen beküldték (a wizard végigment). */
  "advisor_submitted",
  "review_submitted",
  "report_submitted",
  "lead_sent",
  "provider_created",
  "push_subscribed",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsEvent(value: string): value is AnalyticsEvent {
  return (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
