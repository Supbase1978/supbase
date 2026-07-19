/**
 * spots Supabase-lekérdezők (3.1 séma). A klienst a hívó (route-loader/
 * -action) adja át PARAMÉTERKÉNT — a modul nem gyárt és nem importál
 * szerver-Supabase-klienst (`@core/auth/supabase.server`), azt kizárólag az
 * app/routes/spotok*.tsx route-fájlok hívják (lásd module.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isReportConditions,
  type ReportConditions,
  type SpotReportRow,
  type SpotRow,
  type WeatherSnapshotRow,
} from "../types";

export async function listSpots(supabase: SupabaseClient): Promise<SpotRow[]> {
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .order("name", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data as SpotRow[];
}

/**
 * Egy spot slug szerint — a `slug` jsonb `hu` VAGY `en` kulcsa egyezhet (a
 * F1.8 locale-prefixelt route-oknál mindkét nyelvű slug elérhető marad).
 * Nincs találat → `null` (a hívó 404-et dob).
 */
/** Slug-alak: kisbetű/szám/kötőjel — minden seed-slug ilyen (3.1 jsonb slug). */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function getSpotBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<SpotRow | null> {
  // A slug URL-paraméter és nyersen kerül a PostgREST .or() szűrő-stringbe —
  // az alak-ellenőrzés kizárja a szűrő-injektálást (vessző/zárójel/operátor).
  if (!SLUG_PATTERN.test(slug)) {
    return null;
  }
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .or(`slug->>hu.eq.${slug},slug->>en.eq.${slug}`)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as SpotRow;
}

/**
 * Tiszta reduce-logika: a legfrissebb (első, mert a lekérdezés `fetched_at`
 * szerint csökkenőn rendezett) snapshot spotonként. Külön exportálva, hogy
 * Supabase-mockolás nélkül, önmagában tesztelhető legyen.
 */
export function pickLatestPerSpot(
  rows: readonly WeatherSnapshotRow[],
): Map<string, WeatherSnapshotRow> {
  const map = new Map<string, WeatherSnapshotRow>();
  for (const row of rows) {
    if (!map.has(row.spot_id)) {
      map.set(row.spot_id, row);
    }
  }
  return map;
}

/**
 * TODO(follow-up): naiv megoldás — legfeljebb 200 legfrissebb sort kérünk le
 * és JS-ben szűrünk spotonkénti legfrissebbre. Ha a spot-szám/snapshot-
 * gyakoriság nő, cseréljük egy `DISTINCT ON (spot_id) ... ORDER BY spot_id,
 * fetched_at DESC` nézetre vagy RPC-re (db-engineer terület).
 */
export async function listLatestSnapshots(
  supabase: SupabaseClient,
  spotIds: readonly string[],
): Promise<Map<string, WeatherSnapshotRow>> {
  if (spotIds.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase
    .from("weather_snapshots")
    .select("*")
    .in("spot_id", spotIds as string[])
    .order("fetched_at", { ascending: false })
    .limit(200);
  if (error || !data) {
    return new Map();
  }
  return pickLatestPerSpot(data as WeatherSnapshotRow[]);
}

export async function getLatestSnapshot(
  supabase: SupabaseClient,
  spotId: string,
): Promise<WeatherSnapshotRow | null> {
  const { data, error } = await supabase
    .from("weather_snapshots")
    .select("*")
    .eq("spot_id", spotId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as WeatherSnapshotRow;
}

export async function listReports(
  supabase: SupabaseClient,
  spotId: string,
  limit = 20,
): Promise<SpotReportRow[]> {
  const { data, error } = await supabase
    .from("spot_reports")
    .select("*")
    .eq("spot_id", spotId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    return [];
  }
  return data as SpotReportRow[];
}

export interface InsertReportInput {
  spot_id: string;
  user_id: string;
  conditions: ReportConditions;
  note?: string | null;
}

export type InsertReportResult =
  | { ok: true }
  | { ok: false; errorKey: "reports.invalidConditions" | "reports.error" };

/**
 * A `conditions`-t insert ELŐTT validáljuk a 4-elemű enumra. Az RLS + a DB
 * CHECK-kényszer a védőháló (soha nem bízunk kizárólag a kliens-oldali
 * ellenőrzésben) — ez a validáció csak a barátságos hibaüzenetért van, hogy
 * ne egy nyers Postgres-hibakódot kapjon a felhasználó.
 */
export async function insertReport(
  supabase: SupabaseClient,
  input: InsertReportInput,
): Promise<InsertReportResult> {
  if (!isReportConditions(input.conditions)) {
    return { ok: false, errorKey: "reports.invalidConditions" };
  }

  const { error } = await supabase.from("spot_reports").insert({
    spot_id: input.spot_id,
    user_id: input.user_id,
    conditions: input.conditions,
    note: input.note && input.note.length > 0 ? input.note : null,
  });

  if (error) {
    return { ok: false, errorKey: "reports.error" };
  }
  return { ok: true };
}
