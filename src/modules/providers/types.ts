/**
 * providers sor-típusok (3.1 séma, B2B szolgáltatói directory). A `slug`/
 * `description` fordítható jsonb (Record<string,string>); a `type` a szolgáltatás-
 * fajták tömbje (Postgres text[]).
 */

/** providers.type CHECK-értékkészletével egyező szolgáltatás-fajták (3.1). */
export type ProviderServiceType = "rental" | "tour" | "lesson" | "accommodation";

export const PROVIDER_SERVICE_TYPES: readonly ProviderServiceType[] = [
  "rental",
  "tour",
  "lesson",
  "accommodation",
];

export function isProviderServiceType(value: unknown): value is ProviderServiceType {
  return (
    typeof value === "string" &&
    (PROVIDER_SERVICE_TYPES as readonly string[]).includes(value)
  );
}

/** providers.tier — `free` (alap) vagy `premium` (fizetős, admin/számlázás állítja). */
export type ProviderTier = "free" | "premium";

/** provider_leads.status életciklus (3.1 CHECK). */
export type ProviderLeadStatus = "new" | "contacted" | "closed";

/** `public.providers` sor (3.1) — minden oszlop. */
export interface ProviderRow {
  id: string;
  /** "Claim your listing" — a tulajdonos profilja, vagy null (nem átvett seed). */
  owner_user_id: string | null;
  name: string;
  slug: Record<string, string>;
  type: ProviderServiceType[];
  description: Record<string, string> | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  tier: ProviderTier;
  /** Admin-állította jelvény (trigger-védett: user sose írhatja). */
  verified: boolean;
  created_at: string;
}

/** `public.provider_spots` sor (3.1) — provider↔spot kötés. */
export interface ProviderSpotRow {
  provider_id: string;
  spot_id: string;
}

/** `public.provider_leads` sor (3.1) — érdeklődés. */
export interface ProviderLeadRow {
  id: string;
  provider_id: string;
  user_id: string | null;
  name: string | null;
  email: string;
  message: string | null;
  status: ProviderLeadStatus;
  created_at: string;
}

/** A profil-oldalon megjelenített kötött spot (provider_spots → spots join). */
export interface ProviderLinkedSpot {
  id: string;
  name: string;
  slug: string;
}
