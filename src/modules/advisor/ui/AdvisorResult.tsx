/**
 * Deszkaválasztó eredmény-képernyő (5.2 kimenet): 1 nagy ajánlás + max 2 kompakt,
 * indoklás-listával. Az indoklások {key, params} formában jönnek; a `level`/`use`
 * paraméterek maguk i18n-KULCSOK (pl. "level.kezdo"), ezért render előtt fel kell
 * oldani őket (`t(params.level)`), majd a reason-kulcsot interpolálni.
 *
 * A „{{score}}% neked" badge amber, MINDIG sötét (`--text`) felirattal (2. fejezet
 * 7. pont). A megosztás-kártya OG-képe F1.8 — most csak egyszerű gomb-placeholder.
 */
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Button, Card, cx, RatingBar } from "@core/ui";

import type { AdvisorReason } from "../select/types";
import { cmToFeetInches } from "./format";

export interface AdvisorResultBoard {
  boardId: string;
  slug: string;
  modelName: string;
  brandName: string | null;
  imageUrl: string | null;
  priceHuf: number | null;
  /** 0–100. */
  score: number;
  reasons: AdvisorReason[];
  /** Közös nevező összesített átlaga 0–10 skálán; null → még nincs értékelés. */
  ratingTen: number | null;
  /** Publikált vélemények száma. */
  reviewCount: number;
}

export interface AdvisorResultProps {
  results: readonly AdvisorResultBoard[];
  /**
   * A megadott testmagasság és a hozzá számított ideális deszkahossz (cm).
   * null → a felhasználó nem adott meg magasságot; ilyenkor a sáv sem jelenik
   * meg (nem állítunk olyat, amit nem vettünk figyelembe).
   */
  heightFit: { heightCm: number; idealLengthCm: number } | null;
}

export function AdvisorResult({ results, heightFit }: AdvisorResultProps) {
  const { t, i18n } = useTranslation("advisor");
  const nf = new Intl.NumberFormat(i18n.language);

  /** Indoklás feloldása: level/use param → i18n-kulcs → szöveg, majd interpoláció. */
  const reasonText = (reason: AdvisorReason): string => {
    const params: Record<string, string | number> = { ...reason.params };
    if (typeof params.level === "string") params.level = t(params.level);
    if (typeof params.use === "string") params.use = t(params.use);
    return t(reason.key, params);
  };

  if (results.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-text-2">{t("result.empty")}</p>
        <Link
          to="/deszkavalaszto"
          className="inline-flex min-h-[var(--cta-height)] w-fit items-center justify-center rounded-[var(--radius-cta)] bg-amber px-6 font-bold text-text"
        >
          {t("result.restart")}
        </Link>
      </div>
    );
  }

  const [top, ...rest] = results;
  const others = rest.slice(0, 2);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-2">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("result.title")}
        </h1>
        <Link to="/deszkavalaszto" className="text-sm font-semibold text-petrol-text underline">
          {t("result.restart")}
        </Link>
      </div>

      {/* Láthatóvá teszi, hogy a magasságot FIGYELEMBE VETTÜK: a hossz-illesztés
          csak egy 10 %-os rész-pont, ezért ritkán kerül a top-2 indoklás közé —
          enélkül a felhasználónak úgy tűnne, a válasza nem számított. */}
      {heightFit ? (
        <p className="rounded-[var(--radius-card)] bg-mist px-4 py-3 text-sm text-text-2">
          {t("result.idealLength", {
            height: heightFit.heightCm,
            ideal: Math.round(heightFit.idealLengthCm),
            feet: cmToFeetInches(heightFit.idealLengthCm),
          })}
        </p>
      ) : null}

      {/* Legjobb választás — nagy kártya */}
      {top ? (
        <section className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-wide text-text-3 uppercase">
            {t("result.topMatch")}
          </span>
          <Card className="flex flex-col gap-3">
            <BoardMedia
              imageUrl={top.imageUrl}
              modelName={top.modelName}
              score={top.score}
              scoreLabel={t("result.matchLabel", { score: Math.round(top.score) })}
              large
            />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-ink-deep">{top.modelName}</span>
                {top.brandName ? (
                  <span className="text-sm text-text-2">{top.brandName}</span>
                ) : null}
              </div>
              {top.priceHuf !== null ? (
                <span className="text-lg font-bold text-text">{nf.format(top.priceHuf)} Ft</span>
              ) : null}
            </div>
            <CommonGround
              slug={top.slug}
              ratingTen={top.ratingTen}
              reviewCount={top.reviewCount}
              size="lg"
            />
            <ul className="flex flex-col gap-1.5">
              {top.reasons.map((reason, i) => (
                <li key={i} className="flex gap-2 text-sm text-text-2">
                  <span aria-hidden="true" className="text-safe-text">
                    ✓
                  </span>
                  {reasonText(reason)}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/deszkak/${top.slug}`}
                className="inline-flex min-h-[var(--cta-height)] items-center justify-center rounded-[var(--radius-cta)] bg-amber px-6 font-bold text-text"
              >
                {t("result.viewBoard")}
              </Link>
              <Button type="button" variant="ghost">
                {t("result.share")}
              </Button>
            </div>
          </Card>
        </section>
      ) : null}

      {/* További ajánlások — kompakt kártyák */}
      {others.length > 0 ? (
        <section className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-wide text-text-3 uppercase">
            {t("result.otherMatches")}
          </span>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {others.map((board) => (
              <li key={board.boardId}>
                <Card className="flex h-full flex-col gap-2">
                  <BoardMedia
                    imageUrl={board.imageUrl}
                    modelName={board.modelName}
                    score={board.score}
                    scoreLabel={t("result.matchLabel", { score: Math.round(board.score) })}
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink-deep">{board.modelName}</span>
                    {board.priceHuf !== null ? (
                      <span className="text-sm font-bold text-text">
                        {nf.format(board.priceHuf)} Ft
                      </span>
                    ) : null}
                  </div>
                  <CommonGround
                    slug={board.slug}
                    ratingTen={board.ratingTen}
                    reviewCount={board.reviewCount}
                  />
                  <Link
                    to={`/deszkak/${board.slug}`}
                    className="mt-auto text-sm font-semibold text-petrol-text underline"
                  >
                    {t("result.viewBoard")}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * „Közös nevező" az ajánlás-kártyán: 10-es mérce + számérték + darabszám,
 * LINKKÉNT a deszka-adatlap Közös nevező blokkjára (#kozos-nevezo).
 *
 * A sáv a core `RatingBar` (NEM a biztonsági Gauge — egy vélemény-átlag nem
 * „veszély", ezért danger itt tilos), és a szám MINDIG a sáv mellett van
 * (2. fejezet: szín + szöveg, sosem csak szín).
 */
function CommonGround({
  slug,
  ratingTen,
  reviewCount,
  size = "sm",
}: {
  slug: string;
  ratingTen: number | null;
  reviewCount: number;
  size?: "sm" | "lg";
}) {
  const { t, i18n } = useTranslation("advisor");
  const nf1 = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  if (ratingTen === null || reviewCount === 0) {
    return <p className="text-xs text-text-3">{t("result.noReviews")}</p>;
  }

  const label = t("result.ratingAria", {
    value: nf1.format(ratingTen),
    count: reviewCount,
  });

  return (
    <Link
      to={`/deszkak/${slug}#kozos-nevezo`}
      className="flex flex-col gap-1 rounded-[var(--radius-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol"
      aria-label={label}
    >
      <span className="flex items-baseline gap-2">
        <span className="text-xs font-semibold text-petrol-text underline">
          {t("result.commonGround")}
        </span>
        <span className={cx("font-bold text-ink-deep", size === "lg" ? "text-base" : "text-sm")}>
          {nf1.format(ratingTen)}
          <span className="text-text-3">/10</span>
        </span>
        <span className="text-xs text-text-3">
          {t("result.reviewCount", { count: reviewCount })}
        </span>
      </span>
      <RatingBar value={ratingTen} size={size} ariaLabel={label} />
    </Link>
  );
}

function BoardMedia({
  imageUrl,
  modelName,
  scoreLabel,
  large = false,
}: {
  imageUrl: string | null;
  modelName: string;
  score: number;
  scoreLabel: string;
  large?: boolean;
}) {
  const heightClass = large ? "h-40" : "h-28";
  return (
    <div className={cx("relative w-full", heightClass)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={modelName}
          className={cx("h-full w-full rounded-[var(--radius-card)] object-cover")}
          loading="lazy"
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-full w-full rounded-[var(--radius-card)]"
          style={{
            background:
              "linear-gradient(135deg, var(--ink-deep) 0%, var(--petrol) 55%, var(--mist) 100%)",
          }}
        />
      )}
      {/* „X% neked" badge — amber, sötét felirat (token-szabály). */}
      <span className="absolute right-2 top-2 rounded-full bg-amber px-2.5 py-1 text-xs font-bold text-text">
        {scoreLabel}
      </span>
    </div>
  );
}
