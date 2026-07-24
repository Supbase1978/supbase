/**
 * providers Supabase-lekérdezők (3.1 séma, B2B). A klienst a hívó (route-loader/
 * -action) adja át PARAMÉTERKÉNT — a modul nem gyárt/importál szerver-klienst.
 * Az írás-gate-eket az RLS kényszeríti ki (providers-migráció): a directory
 * publikusan olvasható; a lead-et bárki (anon is) beküldheti; új listinget csak
 * bejelentkezett user vehet fel a SAJÁT tulajdonaként (`owner_user_id=auth.uid()`,
 * a `verified`/`tier` triggerrel biztonságos defaultra kényszerítve); a `verified`
 * jelvényt csak admin állíthatja. A route-réteg requireUser/requireRole a védőháló.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isProviderServiceType,
  type ProviderRow,
  type ProviderServiceType,
} from "../types";

/** Slug-alak: kisbetű/szám/kötőjel — a `.or()` szűrő-injektálás ellen (catalog-minta). */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Egyszerű, de elég szigorú e-mail-forma a barátságos hibáért (a DB NOT NULL a védőháló). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Név → URL-biztos slug (kisbetű, ékezet-hajtás, nem-alfanumerikus → kötőjel).
 * A `@core/i18n` nem tartalmaz slugify-t; ez a directory saját, tesztelt helpere.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // ékezetek levágása
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Külső URL séma-allowlist: CSAK `http`/`https` engedélyezett. A user-megadta
 * `website_url` linkként renderelődik a nyilvános profilon; a `javascript:` és
 * `data:` séma stored XSS-t adna (a JSX-escape a href-sémát NEM védi). Érvénytelen
 * vagy nem-http(s) → `null`. Insertkor ÉS renderkor alkalmazandó (mélységi védelem).
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
}

/**
 * Tiszta rendezés: kiemelt (`premium`) elöl, azon belül név szerint. Külön
 * exportálva, hogy Supabase-mock nélkül tesztelhető legyen (catalog `pickCheapest`
 * mintája).
 */
export function sortProvidersForList<T extends Pick<ProviderRow, "tier" | "name">>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier === "premium" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "hu");
  });
}

export async function listProviders(supabase: SupabaseClient): Promise<ProviderRow[]> {
  const { data, error } = await supabase.from("providers").select("*");
  if (error || !data) {
    return [];
  }
  return sortProvidersForList(data as ProviderRow[]);
}

/**
 * Egy szolgáltató slug szerint — a `slug` jsonb `hu` VAGY `en` kulcsa egyezhet.
 * A slug URL-paraméter, nyersen kerül a PostgREST `.or()` szűrőbe: az
 * alak-ellenőrzés kizárja a szűrő-injektálást. Nincs találat → `null` (404).
 */
export async function getProviderBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ProviderRow | null> {
  if (!SLUG_PATTERN.test(slug)) {
    return null;
  }
  const { data, error } = await supabase
    .from("providers")
    .select("*")
    .or(`slug->>hu.eq.${slug},slug->>en.eq.${slug}`)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as ProviderRow;
}

/**
 * A szolgáltatóhoz kötött spotok (provider_spots → spots join). A spot slug/név
 * a profil „Kapcsolódó spotok” blokkjához; a locale-választást a hívó végzi.
 */
export async function listLinkedSpots(
  supabase: SupabaseClient,
  providerId: string,
): Promise<{ spotId: string; name: string; slug: Record<string, string> }[]> {
  const { data, error } = await supabase
    .from("provider_spots")
    .select("spot_id, spot:spots(id, name, slug)")
    .eq("provider_id", providerId);
  if (error || !data) {
    return [];
  }
  type Joined = { spot_id: string; spot: { name: string; slug: Record<string, string> } | null };
  return (data as unknown as Joined[])
    .filter((row): row is Joined & { spot: NonNullable<Joined["spot"]> } => row.spot !== null)
    .map((row) => ({ spotId: row.spot_id, name: row.spot.name, slug: row.spot.slug }));
}

// ---------------------------------------------------------------------------
// Lead (érdeklődés) — insert-gate: bárki (anon is), e-mail kötelező.
// ---------------------------------------------------------------------------

export interface InsertLeadInput {
  provider_id: string;
  user_id: string | null;
  name?: string | null;
  email: string;
  message?: string | null;
}

export type InsertLeadResult =
  | { ok: true }
  | { ok: false; errorKey: "lead.invalidEmail" | "lead.error" };

export async function insertLead(
  supabase: SupabaseClient,
  input: InsertLeadInput,
): Promise<InsertLeadResult> {
  if (!EMAIL_PATTERN.test(input.email)) {
    return { ok: false, errorKey: "lead.invalidEmail" };
  }
  const { error } = await supabase.from("provider_leads").insert({
    provider_id: input.provider_id,
    user_id: input.user_id,
    name: input.name && input.name.length > 0 ? input.name : null,
    email: input.email,
    message: input.message && input.message.length > 0 ? input.message : null,
  });
  if (error) {
    return { ok: false, errorKey: "lead.error" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Új listing ("claim/regisztráció") — requireUser; owner=self, verified=false.
// ---------------------------------------------------------------------------

export interface InsertProviderInput {
  owner_user_id: string;
  name: string;
  types: ProviderServiceType[];
  description_hu?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
}

export type InsertProviderResult =
  | { ok: true; slug: string }
  | { ok: false; errorKey: "new.missingName" | "new.missingType" | "new.error" };

/**
 * A slug-ütközés feloldása: alap-slug, majd `-2`, `-3`… amíg szabad. Az utolsó
 * mentsvár egy időbélyeg-toldalék, hogy a beszúrás sose akadjon el ütközésen.
 */
async function resolveUniqueSlug(supabase: SupabaseClient, base: string): Promise<string> {
  const safeBase = base.length > 0 ? base : "szolgaltato";
  for (let i = 0; i < 10; i += 1) {
    const candidate = i === 0 ? safeBase : `${safeBase}-${i + 1}`;
    const { data, error } = await supabase
      .from("providers")
      .select("id")
      .eq("slug->>hu", candidate)
      .limit(1)
      .maybeSingle();
    if (error) {
      break;
    }
    if (!data) {
      return candidate;
    }
  }
  return `${safeBase}-${Date.now().toString(36)}`;
}

export async function insertProvider(
  supabase: SupabaseClient,
  input: InsertProviderInput,
): Promise<InsertProviderResult> {
  const name = input.name.trim();
  if (name.length === 0) {
    return { ok: false, errorKey: "new.missingName" };
  }
  const types = input.types.filter(isProviderServiceType);
  if (types.length === 0) {
    return { ok: false, errorKey: "new.missingType" };
  }

  const slug = await resolveUniqueSlug(supabase, slugify(name));

  const { error } = await supabase.from("providers").insert({
    owner_user_id: input.owner_user_id,
    name,
    slug: { hu: slug, en: slug },
    type: types,
    description:
      input.description_hu && input.description_hu.trim().length > 0
        ? { hu: input.description_hu.trim(), en: input.description_hu.trim() }
        : null,
    contact_email: input.contact_email?.trim() || null,
    contact_phone: input.contact_phone?.trim() || null,
    // Séma-allowlist (http/https) a stored XSS ellen — lásd safeExternalUrl.
    website_url: safeExternalUrl(input.website_url),
    // verified/tier a trigger kényszeríti biztonságos defaultra (false/free).
  });
  if (error) {
    return { ok: false, errorKey: "new.error" };
  }
  return { ok: true, slug };
}

// ---------------------------------------------------------------------------
// ADMIN (moderátori/admin jog; az RLS + requireRole kényszeríti).
// ---------------------------------------------------------------------------

export async function listProvidersByVerified(
  supabase: SupabaseClient,
  verified: boolean,
): Promise<ProviderRow[]> {
  const { data, error } = await supabase
    .from("providers")
    .select("*")
    .eq("verified", verified)
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data as ProviderRow[];
}

export async function setProviderVerified(
  supabase: SupabaseClient,
  providerId: string,
  value: boolean,
): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from("providers")
    .update({ verified: value })
    .eq("id", providerId);
  return { ok: !error };
}
