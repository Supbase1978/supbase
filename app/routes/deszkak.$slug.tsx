/**
 * /deszkak/:slug — deszka-adatlap (F1.5). A catalog (deszka) és a reviews
 * (Népítélet) modul összekötése KIZÁRÓLAG itt, a route-rétegben történik
 * (1.3 modul-szerződés: a catalog nem importál reviews-t és fordítva).
 *
 * A komponens F1.5-vázként natív form-elemekkel épül; a ui-builder cseréli a
 * Népítélet-blokkot RatingBar-okra és finomítja a rétegeket (TODO-k jelölik).
 * TOKEN-MEGKÖTÉS (ui-builder): az értékelés-sávok NEM a biztonsági Gauge-ot
 * használják (az veszély-szemantikájú), és a `--danger` (piros) értékelés-sávon
 * TILOS — külön RatingBar (petrol/semleges vagy safe/caution), a szám mindig ott.
 */
import { useTranslation } from "react-i18next";
import { data, Form, Link } from "react-router";

import { getUser, requireUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { isEmailConfirmed } from "@core/auth/email-confirmed";
import { getLocaleFromPath, pickTranslated } from "@core/i18n";
import { Button, Card, StatusBadge } from "@core/ui";
import { getBoardBySlug, listBoardPrices } from "@modules/catalog/data/boards.server";
import { computeReviewAggregate, toTen } from "@modules/reviews/aggregate";
import {
  getUserReview,
  insertFlag,
  insertReview,
  listReviews,
} from "@modules/reviews/data/reviews.server";
import {
  isFlagReason,
  isUsedWaterType,
  REVIEW_DIMENSIONS,
  REVIEW_FLAG_REASONS,
  USED_WATER_TYPES,
  type ReviewDimension,
} from "@modules/reviews/types";

import type { Route } from "./+types/deszkak.$slug";

/** formData → 1–5 rating vagy null (üres/„-" választás). */
function parseRating(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);

  const board = await getBoardBySlug(supabase, slug);
  if (!board) {
    throw new Response("Not Found", { status: 404 });
  }

  const [prices, reviewRows, user] = await Promise.all([
    listBoardPrices(supabase, board.id),
    listReviews(supabase, board.id, { publishedOnly: true }),
    getUser(request),
  ]);

  const aggregate = computeReviewAggregate(reviewRows);
  const ownReview = user ? await getUserReview(supabase, board.id, user.id) : null;

  return {
    board: {
      id: board.id,
      slug: pickTranslated(board.slug, locale),
      modelName: board.model_name,
      modelYear: board.model_year,
      brandName: board.brand?.name ?? null,
      boardType: board.board_type,
      lengthCm: board.length_cm,
      widthCm: board.width_cm,
      thicknessCm: board.thickness_cm,
      volumeL: board.volume_l,
      weightKg: board.weight_kg,
      riderWeightMinKg: board.rider_weight_min_kg,
      riderWeightMaxKg: board.rider_weight_max_kg,
      maxLoadKg: board.max_load_kg,
      inflatable: board.inflatable,
      stabilityIndex: board.stability_index,
      manualUrl: board.manual_url,
      description: pickTranslated(board.description, locale) || null,
    },
    prices: prices.map((p) => ({
      id: p.id,
      shopName: p.shop_name,
      url: p.url,
      priceHuf: p.price_huf,
    })),
    aggregate,
    // A Népítélet-mércékhez 10-es skálázott dimenzió-értékek (1–5 → *2).
    dimensionsTen: Object.fromEntries(
      REVIEW_DIMENSIONS.map((dim) => [dim, toTen(aggregate.perDimension[dim])]),
    ) as Record<ReviewDimension, number | null>,
    overallTen: toTen(aggregate.avgOverall),
    reviews: reviewRows.map((r) => ({
      id: r.id,
      ratingOverall: r.rating_overall,
      textPros: r.text_pros,
      textCons: r.text_cons,
      verifiedOwner: r.verified_owner,
      createdAt: r.created_at,
    })),
    reviewForm: {
      isLoggedIn: Boolean(user),
      isEmailConfirmed: isEmailConfirmed(user),
      hasOwnReview: Boolean(ownReview),
    },
  };
}

type ActionResult =
  | { ok: true; intent: "review" | "flag" }
  | {
      ok: false;
      errorKey:
        | "form.confirmPrompt"
        | "form.invalidRating"
        | "form.alreadyReviewed"
        | "form.error"
        | "flag.error";
    };

export async function action({ request, params }: Route.ActionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const user = await requireUser(request);
  const { supabase, headers } = createSupabaseServerClient(request);

  if (!isEmailConfirmed(user)) {
    return data<ActionResult>({ ok: false, errorKey: "form.confirmPrompt" }, { headers });
  }

  const board = await getBoardBySlug(supabase, slug);
  if (!board) {
    throw new Response("Not Found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "flag") {
    const reviewId = String(formData.get("reviewId") ?? "");
    const reason = String(formData.get("reason") ?? "");
    if (!isFlagReason(reason)) {
      return data<ActionResult>({ ok: false, errorKey: "flag.error" }, { headers });
    }
    const result = await insertFlag(supabase, {
      review_id: reviewId,
      flagged_by: user.id,
      reason,
      note: trimmedOrNull(formData.get("note")),
    });
    return result.ok
      ? data<ActionResult>({ ok: true, intent: "flag" }, { headers })
      : data<ActionResult>({ ok: false, errorKey: result.errorKey }, { headers });
  }

  // Alapértelmezett: vélemény-beküldés.
  const usedWaterTypeRaw = String(formData.get("usedWaterType") ?? "");
  const result = await insertReview(supabase, {
    board_id: board.id,
    user_id: user.id,
    rating_overall: parseRating(formData.get("ratingOverall")) ?? 0,
    rating_stability: parseRating(formData.get("ratingStability")),
    rating_glide: parseRating(formData.get("ratingGlide")),
    rating_build: parseRating(formData.get("ratingBuild")),
    rating_value: parseRating(formData.get("ratingValue")),
    text_pros: trimmedOrNull(formData.get("textPros")),
    text_cons: trimmedOrNull(formData.get("textCons")),
    used_water_type: isUsedWaterType(usedWaterTypeRaw) ? usedWaterTypeRaw : null,
  });

  return result.ok
    ? data<ActionResult>({ ok: true, intent: "review" }, { headers })
    : data<ActionResult>({ ok: false, errorKey: result.errorKey }, { headers });
}

export const meta: Route.MetaFunction = ({ data: loaderData }) => {
  return [{ title: `[APPNÉV] — ${loaderData?.board.modelName ?? "Deszka"}` }];
};

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export default function BoardDetailRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { t, i18n } = useTranslation("catalog");
  const { t: tr } = useTranslation("reviews");
  const { board, prices, aggregate, dimensionsTen, overallTen, reviews, reviewForm } = loaderData;

  const cheapest = prices.length > 0 ? prices[0] : null;
  const nf = new Intl.NumberFormat(i18n.language);
  const fmt1 = (v: number | null) =>
    v === null
      ? "—"
      : new Intl.NumberFormat(i18n.language, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(v);

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        {/* TODO(ui-builder): deszka-hero (kép, „X% neked"-badge az advisorból F1.6). */}
        <div className="h-40 w-full rounded-[var(--radius-card)] bg-mist" aria-hidden="true" />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1
            className="text-3xl font-semibold text-ink-deep"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {board.modelName}
          </h1>
          {cheapest ? (
            <span className="text-lg font-bold text-text">
              {nf.format(cheapest.priceHuf)} Ft{t("detail.priceFrom")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-2">
          {board.brandName ? <span>{board.brandName}</span> : null}
          <span>· {t(`boardType.${board.boardType}`)}</span>
          {board.modelYear ? <span>· {board.modelYear}</span> : null}
          <span>· {t(`inflatable.${board.inflatable}`)}</span>
        </div>
      </header>

      {/* Paraméterek */}
      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">{t("detail.specs")}</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-text-2">
          <SpecItem label={t("spec.length")} value={board.lengthCm} unit="cm" />
          <SpecItem label={t("spec.width")} value={board.widthCm} unit="cm" />
          <SpecItem label={t("spec.thickness")} value={board.thicknessCm} unit="cm" />
          <SpecItem label={t("spec.volume")} value={board.volumeL} unit="l" />
          <SpecItem label={t("spec.weight")} value={board.weightKg} unit="kg" />
          <SpecItem label={t("spec.maxLoad")} value={board.maxLoadKg} unit="kg" />
          <SpecItem label={t("spec.stabilityIndex")} value={board.stabilityIndex} />
        </dl>
        {board.description ? (
          <p className="mt-3 text-sm text-text-2">{board.description}</p>
        ) : null}
      </Card>

      {/* Népítélet */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink-deep">{tr("block.title")}</h2>
          {aggregate.count > 0 ? (
            <span className="text-sm text-text-2">
              {tr("block.count", { count: aggregate.count })}
            </span>
          ) : null}
        </div>

        {aggregate.count === 0 ? (
          <Card>
            <p className="text-sm text-text-2">{tr("block.empty")}</p>
          </Card>
        ) : (
          <Card>
            {/* TODO(ui-builder): a dimenzió-sorok RatingBar-ra (10-seg, NEM Gauge,
                NEM danger); nagy átlag + % ajánlaná + hitelesített-szám. */}
            <div className="flex items-center gap-4">
              <span
                className="text-4xl font-bold text-ink-deep"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {fmt1(aggregate.avgOverall)}
              </span>
              <div className="flex flex-col text-sm text-text-2">
                <span>{tr("block.recommend", { percent: aggregate.percentRecommend })}</span>
                {aggregate.verifiedCount > 0 ? (
                  <span>{tr("block.verifiedCount", { count: aggregate.verifiedCount })}</span>
                ) : null}
              </div>
            </div>
            <dl className="mt-3 flex flex-col gap-1 text-sm text-text-2">
              {REVIEW_DIMENSIONS.map((dim) => (
                <div key={dim} className="flex items-center justify-between gap-3">
                  <dt>{tr(`dim.${dim}`)}</dt>
                  <dd className="font-semibold text-petrol-text">{fmt1(dimensionsTen[dim])}</dd>
                </div>
              ))}
            </dl>
            <p className="sr-only">{fmt1(overallTen)}</p>
          </Card>
        )}
      </section>

      {/* Vélemény-lista */}
      {reviews.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <Card>
                <div className="flex items-center justify-between gap-2">
                  {review.verifiedOwner ? (
                    <StatusBadge status="safe" label={tr("verifiedOwner")} />
                  ) : (
                    <span />
                  )}
                  <span className="text-sm font-semibold text-text">★ {review.ratingOverall}</span>
                </div>
                {review.textPros ? (
                  <p className="mt-2 text-sm text-text-2">{review.textPros}</p>
                ) : null}
                {review.textCons ? (
                  <p className="mt-1 text-sm text-text-3">{review.textCons}</p>
                ) : null}
                {/* TODO(ui-builder): flag-gomb egy kis felugró/rejtett formmal
                    (reviewId + reason select). A gate: reviewForm.isLoggedIn. */}
                {reviewForm.isLoggedIn && reviewForm.isEmailConfirmed ? (
                  <Form method="post" className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="intent" value="flag" />
                    <input type="hidden" name="reviewId" value={review.id} />
                    <select
                      name="reason"
                      aria-label={tr("flag.reason")}
                      defaultValue={REVIEW_FLAG_REASONS[0]}
                      className="rounded-[var(--radius-card)] border border-line px-2 py-1 text-xs"
                    >
                      {REVIEW_FLAG_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {tr(`flag.reasonOption.${reason}`)}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="ghost">
                      {tr("flag.action")}
                    </Button>
                  </Form>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Vélemény-űrlap (e-mail-gate) */}
      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">{tr("form.title")}</h2>
        {!reviewForm.isLoggedIn ? (
          <p className="mt-2 text-sm text-text-2">
            {tr("form.loginPrompt")}{" "}
            <Link to="/belepes" className="font-semibold text-petrol underline">
              {tr("form.loginCta")}
            </Link>
          </p>
        ) : !reviewForm.isEmailConfirmed ? (
          <p className="mt-2 text-sm text-text-2">{tr("form.confirmPrompt")}</p>
        ) : reviewForm.hasOwnReview ? (
          <p className="mt-2 text-sm text-text-2">{tr("form.alreadyReviewed")}</p>
        ) : (
          <Form method="post" className="mt-2 flex flex-col gap-3">
            <RatingSelect name="ratingOverall" label={tr("form.overall")} required />
            <RatingSelect name="ratingStability" label={tr("form.stability")} />
            <RatingSelect name="ratingGlide" label={tr("form.glide")} />
            <RatingSelect name="ratingBuild" label={tr("form.build")} />
            <RatingSelect name="ratingValue" label={tr("form.value")} />

            <label htmlFor="usedWaterType" className="text-sm font-semibold text-text-2">
              {tr("form.usedWaterType")}
            </label>
            <select
              id="usedWaterType"
              name="usedWaterType"
              defaultValue=""
              className="rounded-[var(--radius-card)] border border-line px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {USED_WATER_TYPES.map((w) => (
                <option key={w} value={w}>
                  {tr(`waterType.${w}`)}
                </option>
              ))}
            </select>

            <label htmlFor="textPros" className="text-sm font-semibold text-text-2">
              {tr("form.pros")}
            </label>
            <textarea
              id="textPros"
              name="textPros"
              rows={2}
              className="rounded-[var(--radius-card)] border border-line px-3 py-2 text-sm"
            />
            <label htmlFor="textCons" className="text-sm font-semibold text-text-2">
              {tr("form.cons")}
            </label>
            <textarea
              id="textCons"
              name="textCons"
              rows={2}
              className="rounded-[var(--radius-card)] border border-line px-3 py-2 text-sm"
            />

            <Button type="submit" variant="primary">
              {tr("form.submit")}
            </Button>
          </Form>
        )}
        {actionData && !actionData.ok ? (
          <StatusBadge status="caution" label={tr(actionData.errorKey)} className="mt-2" />
        ) : null}
        {actionData?.ok && actionData.intent === "review" ? (
          <StatusBadge status="safe" label={tr("form.success")} className="mt-2" />
        ) : null}
        {actionData?.ok && actionData.intent === "flag" ? (
          <StatusBadge status="safe" label={tr("flag.success")} className="mt-2" />
        ) : null}
      </Card>

      {/* Hol kapható */}
      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">{t("detail.prices")}</h2>
        {prices.length === 0 ? (
          <p className="mt-2 text-sm text-text-2">{t("detail.noPrices")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {prices.map((price) => (
              <li key={price.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-text-2">{price.shopName}</span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-text">{nf.format(price.priceHuf)} Ft</span>
                  {price.url ? (
                    <a
                      href={price.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-petrol-text underline"
                    >
                      {t("detail.prices")}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

function SpecItem({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  if (value === null) {
    return null;
  }
  return (
    <div>
      <dt className="inline font-semibold">{label}: </dt>
      <dd className="inline">
        {value}
        {unit ? ` ${unit}` : ""}
      </dd>
    </div>
  );
}

function RatingSelect({
  name,
  label,
  required = false,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={name} className="text-sm font-semibold text-text-2">
        {label}
        {required ? " *" : ""}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue=""
        className="rounded-[var(--radius-card)] border border-line px-3 py-2 text-sm"
      >
        <option value="">—</option>
        {RATING_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
