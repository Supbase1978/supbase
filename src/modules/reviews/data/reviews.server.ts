/**
 * reviews Supabase-lekérdezők (3.1: board_reviews + review_flags). A klienst a
 * hívó (route-loader/-action) adja át PARAMÉTERKÉNT. Az írás-gate-et (bejelentkezve
 * + megerősített e-mail + saját sor) az RLS kényszeríti ki (reviews-migráció);
 * a route-réteg requireUser + isEmailConfirmed előszűrést is végez a barátságos
 * hibaüzenetért, a moderátori műveleteket requireRole('moderator') fedi.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import {
  isFlagReason,
  type BoardReviewRow,
  type FlagReason,
  type ReviewFlagRow,
  type ReviewStatus,
  type UsedWaterType,
} from "../types";

/** Postgres unique_violation — a `unique (board_id, user_id)` ütközés kódja. */
const UNIQUE_VIOLATION = "23505";

export interface ListReviewsOptions {
  /** true (alap): csak publikált; false: minden státusz (admin/tulajdonos nézet). */
  publishedOnly?: boolean;
}

export async function listReviews(
  supabase: SupabaseClient,
  boardId: string,
  { publishedOnly = true }: ListReviewsOptions = {},
): Promise<BoardReviewRow[]> {
  let query = supabase.from("board_reviews").select("*").eq("board_id", boardId);
  if (publishedOnly) {
    query = query.eq("status", "published");
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data as BoardReviewRow[];
}

/**
 * MINDEN publikált vélemény, board-tól függetlenül (F1.6 Deszkaválasztó: a
 * route boardonként csoportosítja + `computeReviewAggregate`-tel aggregálja,
 * hogy egy query-vel álljon elő az összes deszka Közös nevező-átlaga).
 */
export async function listAllPublishedReviews(supabase: SupabaseClient): Promise<BoardReviewRow[]> {
  const { data, error } = await supabase.from("board_reviews").select("*").eq("status", "published");
  if (error || !data) {
    return [];
  }
  return data as BoardReviewRow[];
}

/** Az adott user véleménye erre a deszkára (unique board_id+user_id), null ha nincs. */
export async function getUserReview(
  supabase: SupabaseClient,
  boardId: string,
  userId: string,
): Promise<BoardReviewRow | null> {
  const { data, error } = await supabase
    .from("board_reviews")
    .select("*")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as BoardReviewRow;
}

export interface InsertReviewInput {
  board_id: string;
  user_id: string;
  rating_overall: number;
  rating_stability?: number | null;
  rating_glide?: number | null;
  rating_build?: number | null;
  rating_value?: number | null;
  text_pros?: string | null;
  text_cons?: string | null;
  used_water_type?: UsedWaterType | null;
  used_rider_weight_kg?: number | null;
}

export type InsertReviewResult =
  | { ok: true }
  | { ok: false; errorKey: "form.invalidRating" | "form.alreadyReviewed" | "form.error" };

function isValidRating(value: number | null | undefined, required = false): boolean {
  if (value === null || value === undefined) {
    return !required;
  }
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Vélemény beszúrása. A rating-tartományt (1–5) insert ELŐTT ellenőrizzük a
 * barátságos hibáért; az RLS + DB CHECK a védőháló. A `unique (board_id,
 * user_id)` ütközés a „már írtál" üzenetre fordul.
 */
export async function insertReview(
  supabase: SupabaseClient,
  input: InsertReviewInput,
): Promise<InsertReviewResult> {
  if (!isValidRating(input.rating_overall, true)) {
    return { ok: false, errorKey: "form.invalidRating" };
  }
  for (const optional of [
    input.rating_stability,
    input.rating_glide,
    input.rating_build,
    input.rating_value,
  ]) {
    if (!isValidRating(optional)) {
      return { ok: false, errorKey: "form.invalidRating" };
    }
  }

  const { error } = await supabase.from("board_reviews").insert({
    board_id: input.board_id,
    user_id: input.user_id,
    rating_overall: input.rating_overall,
    rating_stability: input.rating_stability ?? null,
    rating_glide: input.rating_glide ?? null,
    rating_build: input.rating_build ?? null,
    rating_value: input.rating_value ?? null,
    text_pros: input.text_pros ?? null,
    text_cons: input.text_cons ?? null,
    used_water_type: input.used_water_type ?? null,
    used_rider_weight_kg: input.used_rider_weight_kg ?? null,
  });

  if (error) {
    if ((error as PostgrestError).code === UNIQUE_VIOLATION) {
      return { ok: false, errorKey: "form.alreadyReviewed" };
    }
    return { ok: false, errorKey: "form.error" };
  }
  return { ok: true };
}

export interface InsertFlagInput {
  review_id: string;
  flagged_by: string;
  reason: FlagReason;
  note?: string | null;
}

export type InsertFlagResult =
  | { ok: true }
  | { ok: false; errorKey: "flag.error" };

export async function insertFlag(
  supabase: SupabaseClient,
  input: InsertFlagInput,
): Promise<InsertFlagResult> {
  if (!isFlagReason(input.reason)) {
    return { ok: false, errorKey: "flag.error" };
  }
  const { error } = await supabase.from("review_flags").insert({
    review_id: input.review_id,
    flagged_by: input.flagged_by,
    reason: input.reason,
    note: input.note && input.note.length > 0 ? input.note : null,
  });
  if (error) {
    return { ok: false, errorKey: "flag.error" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ADMIN (moderátori jog; az RLS kényszeríti, a route requireRole('moderator')).
// ---------------------------------------------------------------------------

export async function listPendingReviews(supabase: SupabaseClient): Promise<BoardReviewRow[]> {
  const { data, error } = await supabase
    .from("board_reviews")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data as BoardReviewRow[];
}

/** Egy jelentett vélemény + a hozzá tartozó feloldatlan jelzések (admin-nézethez). */
export interface FlaggedReview {
  review: BoardReviewRow;
  flags: ReviewFlagRow[];
}

/**
 * Feloldatlan jelzésű vélemények. Két lépés (nincs beágyazott join): előbb a
 * `resolved=false` jelzések, majd az érintett vélemények — JS-ben párosítva.
 */
export async function listFlaggedReviews(supabase: SupabaseClient): Promise<FlaggedReview[]> {
  const { data: flagData, error: flagError } = await supabase
    .from("review_flags")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false });
  if (flagError || !flagData || flagData.length === 0) {
    return [];
  }
  const flags = flagData as ReviewFlagRow[];
  const reviewIds = [...new Set(flags.map((f) => f.review_id))];

  const { data: reviewData, error: reviewError } = await supabase
    .from("board_reviews")
    .select("*")
    .in("id", reviewIds);
  if (reviewError || !reviewData) {
    return [];
  }
  const reviews = reviewData as BoardReviewRow[];

  return reviews.map((review) => ({
    review,
    flags: flags.filter((f) => f.review_id === review.id),
  }));
}

export async function setReviewStatus(
  supabase: SupabaseClient,
  reviewId: string,
  status: ReviewStatus,
): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from("board_reviews")
    .update({ status })
    .eq("id", reviewId);
  return { ok: !error };
}

export async function setVerifiedOwner(
  supabase: SupabaseClient,
  reviewId: string,
  value: boolean,
): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from("board_reviews")
    .update({ verified_owner: value })
    .eq("id", reviewId);
  return { ok: !error };
}

export async function resolveFlag(
  supabase: SupabaseClient,
  flagId: string,
  resolverId: string,
): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from("review_flags")
    .update({ resolved: true, resolved_by: resolverId })
    .eq("id", flagId);
  return { ok: !error };
}
