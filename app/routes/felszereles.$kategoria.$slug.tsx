/**
 * /felszereles/:kategoria/:slug — kiegészítő-adatlap (F2.3 2. szakasz). A
 * catalog (kiegészítő) és a reviews (Közös nevező) modul összekötése
 * KIZÁRÓLAG itt, a route-rétegben történik (1.3 modul-szerződés) — ugyanaz a
 * minta, mint a `/deszkak/:slug`-nál (`deszkak.$slug.tsx`).
 *
 * A Közös nevező itt DIMENZIÓK NÉLKÜL jelenik meg (`getReviewDimensions
 * ("accessory")` → `[]`): a 4 deszka-szempont (stabilitás/siklás/építés/
 * ár-érték) egy evezőn vagy pumpán értelmetlen — csak az összesített pontszám,
 * a % ajánlaná és a szabad szöveg számít. Az űrlap ezért sem kéri a
 * dimenzió-bontást, csak az összbenyomást + az explicit „ajánlom/nem ajánlom"-ot.
 */
import { useTranslation } from "react-i18next";
import { data, Form, Link } from "react-router";

import { recordEvent } from "@core/analytics/analytics.server";
import { getUser, requireUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { isEmailConfirmed } from "@core/auth/email-confirmed";
import { getLocaleFromPath, pickTranslated, serverT } from "@core/i18n";
import { absoluteUrl, buildPageSeo } from "@core/seo/page-seo";
import { productJsonLd } from "@core/seo/jsonld";
import { JsonLd } from "@core/seo/json-ld";
import { Button, Card, StatusBadge } from "@core/ui";
import { getAccessoryBySlug, listBoardPrices } from "@modules/catalog/data/boards.server";
import { isGearCategory } from "@modules/catalog/gear";
import { BoardHero } from "@modules/catalog/ui/BoardHero";
import { computeReviewAggregate, toTen } from "@modules/reviews/aggregate";
import {
  getUserReview,
  insertFlag,
  insertReview,
  listReviews,
} from "@modules/reviews/data/reviews.server";
import { FlagButton } from "@modules/reviews/ui/FlagButton";
import { ReviewCard } from "@modules/reviews/ui/ReviewCard";
import { ReviewSummary } from "@modules/reviews/ui/ReviewSummary";
import { getReviewDimensions, isFlagReason } from "@modules/reviews/types";

import type { Route } from "./+types/felszereles.$kategoria.$slug";

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

function parseWouldRecommend(value: FormDataEntryValue | null): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const kategoria = params.kategoria;
  const slug = params.slug;
  if (!kategoria || !isGearCategory(kategoria) || !slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);
  await recordEvent(supabase, request, "page_view");

  const accessory = await getAccessoryBySlug(supabase, kategoria, slug);
  if (!accessory) {
    throw new Response("Not Found", { status: 404 });
  }

  const [prices, reviewRows, user] = await Promise.all([
    listBoardPrices(supabase, accessory.id),
    listReviews(supabase, accessory.id, { publishedOnly: true }),
    getUser(request),
  ]);

  const aggregate = computeReviewAggregate(reviewRows);
  const ownReview = user ? await getUserReview(supabase, accessory.id, user.id) : null;

  const t = serverT(locale, "catalog");
  const detailPath = `/felszereles/${kategoria}/${pickTranslated(accessory.slug, locale)}`;
  const canonicalUrl = absoluteUrl(request, detailPath, locale);
  const description = pickTranslated(accessory.description, locale) || undefined;
  const seo = buildPageSeo({
    request,
    locale,
    path: detailPath,
    title: t("seo.detail.title", { model: accessory.model_name }),
    description: t("seo.detail.description", {
      model: accessory.model_name,
      brandSuffix: accessory.brand?.name ? ` — ${accessory.brand.name}` : "",
    }),
    imagePath: accessory.image_url,
  });

  const jsonLd = productJsonLd({
    name: accessory.model_name,
    description,
    brand: accessory.brand?.name ?? undefined,
    url: canonicalUrl,
    image: accessory.image_url ?? undefined,
    aggregateRating:
      aggregate.count > 0 && aggregate.avgOverall !== null
        ? { ratingValue: aggregate.avgOverall, reviewCount: aggregate.count }
        : undefined,
    offers: prices.map((p) => ({
      price: p.price_huf,
      priceCurrency: "HUF",
      url: p.url ?? undefined,
      availability: "https://schema.org/InStock" as const,
    })),
  });

  return {
    seo,
    jsonLd,
    category: kategoria,
    accessory: {
      id: accessory.id,
      slug: pickTranslated(accessory.slug, locale),
      modelName: accessory.model_name,
      modelYear: accessory.model_year,
      brandName: accessory.brand?.name ?? null,
      lengthCm: accessory.length_cm,
      widthCm: accessory.width_cm,
      weightKg: accessory.weight_kg,
      imageUrl: accessory.image_url,
      description: pickTranslated(accessory.description, locale) || null,
    },
    prices: prices.map((p) => ({
      id: p.id,
      shopName: p.shop_name,
      url: p.url,
      priceHuf: p.price_huf,
    })),
    aggregate,
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
  const kategoria = params.kategoria;
  const slug = params.slug;
  if (!kategoria || !isGearCategory(kategoria) || !slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const user = await requireUser(request);
  const { supabase, headers } = createSupabaseServerClient(request);

  if (!isEmailConfirmed(user)) {
    return data<ActionResult>({ ok: false, errorKey: "form.confirmPrompt" }, { headers });
  }

  const accessory = await getAccessoryBySlug(supabase, kategoria, slug);
  if (!accessory) {
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

  // Alapértelmezett: vélemény-beküldés. Nincs dimenzió-bontás (getReviewDimensions
  // ("accessory") === []) — a kiegészítő-review csak az összbenyomást, az
  // explicit ajánlást és a szabad szöveget kéri.
  const result = await insertReview(supabase, {
    board_id: accessory.id,
    user_id: user.id,
    rating_overall: parseRating(formData.get("ratingOverall")) ?? 0,
    text_pros: trimmedOrNull(formData.get("textPros")),
    text_cons: trimmedOrNull(formData.get("textCons")),
    would_recommend: parseWouldRecommend(formData.get("wouldRecommend")),
  });

  if (result.ok) {
    await recordEvent(supabase, request, "review_submitted");
  }
  return result.ok
    ? data<ActionResult>({ ok: true, intent: "review" }, { headers })
    : data<ActionResult>({ ok: false, errorKey: result.errorKey }, { headers });
}

export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export default function AccessoryDetailRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("catalog");
  const { t: tr, i18n } = useTranslation("reviews");
  const { category, accessory, prices, aggregate, overallTen, reviews, reviewForm, jsonLd } =
    loaderData;

  const cheapest = prices.length > 0 ? prices[0] : null;
  const nf = new Intl.NumberFormat(i18n.language);
  const canFlag = reviewForm.isLoggedIn && reviewForm.isEmailConfirmed;

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <JsonLd data={jsonLd} />
      <header className="flex flex-col gap-2">
        <Link
          to={`/felszereles/${category}`}
          className="text-sm font-semibold text-petrol-text underline"
        >
          {t(`gear.categories.${category}.title`)}
        </Link>
        <BoardHero modelName={accessory.modelName} imageUrl={accessory.imageUrl} />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1
            className="text-3xl font-semibold text-ink-deep"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {accessory.modelName}
          </h1>
          {cheapest ? (
            <span className="text-lg font-bold text-text">
              {nf.format(cheapest.priceHuf)} Ft{t("detail.priceFrom")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-2">
          {accessory.brandName ? <span>{accessory.brandName}</span> : null}
          {accessory.modelYear ? <span>· {accessory.modelYear}</span> : null}
        </div>
      </header>

      {accessory.lengthCm || accessory.weightKg ? (
        <Card>
          <h2 className="text-lg font-semibold text-ink-deep">{t("detail.specs")}</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-text-2">
            <SpecItem label={t("spec.length")} value={accessory.lengthCm} unit="cm" />
            <SpecItem label={t("spec.width")} value={accessory.widthCm} unit="cm" />
            <SpecItem label={t("spec.weight")} value={accessory.weightKg} unit="kg" />
          </dl>
          {accessory.description ? (
            <p className="mt-3 text-sm text-text-2">{accessory.description}</p>
          ) : null}
        </Card>
      ) : null}

      <div id="kozos-nevezo" className="scroll-mt-4">
        <ReviewSummary
          count={aggregate.count}
          overall={aggregate.avgOverall}
          overallTen={overallTen}
          percentRecommend={aggregate.percentRecommend}
          verifiedCount={aggregate.verifiedCount}
          dimensionsTen={{ stability: null, glide: null, build: null, value: null }}
          dimensions={getReviewDimensions("accessory")}
        />
      </div>

      {reviews.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review}>
                {canFlag ? <FlagButton reviewId={review.id} /> : null}
              </ReviewCard>
            </li>
          ))}
        </ul>
      ) : null}

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

            <label htmlFor="wouldRecommend" className="text-sm font-semibold text-text-2">
              {tr("form.wouldRecommend")}
            </label>
            <select
              id="wouldRecommend"
              name="wouldRecommend"
              defaultValue=""
              className="rounded-[var(--radius-card)] border border-line px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="yes">{tr("form.wouldRecommendYes")}</option>
              <option value="no">{tr("form.wouldRecommendNo")}</option>
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
