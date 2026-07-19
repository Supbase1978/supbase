/**
 * „Közös nevező" — a publikált vélemények aggregált blokkja (Card + RatingBar-ok).
 * A blokk-címben az „evező" rész SZÍNBEN elüt (a közös-nevező ↔ evező szójáték
 * vizuálisan is egyértelmű) — a `--caution-text` meleg amberrel, ami jól elüt a
 * teal címtől, AA-olvasható fehéren, és NEM danger. Ha a fordítás nem tartalmaz
 * „evező"-t (en „Common ground"), a cím tiszta.
 *
 * Az értékelő-sávok a `RatingBar`-ból (NEM a biztonsági Gauge); a számérték
 * mindig a sáv mellett (2. fejezet: szín + szöveg).
 */
import { useTranslation } from "react-i18next";

import { Card } from "@core/ui";

import { REVIEW_DIMENSIONS, type ReviewDimension } from "../types";
import { RatingBar } from "./RatingBar";

export interface ReviewSummaryProps {
  count: number;
  /** Összesített átlag 1–5 (a nagy szám), null ha nincs. */
  overall: number | null;
  /** Összesített 0–10 (a nagy sávhoz). */
  overallTen: number | null;
  percentRecommend: number;
  verifiedCount: number;
  dimensionsTen: Record<ReviewDimension, number | null>;
}

/** A blokk-cím színkiemelt „evező" résszel (a szójáték láttatásához). */
function BlockTitle({ text }: { text: string }) {
  const NEEDLE = "evező";
  const idx = text.toLowerCase().lastIndexOf(NEEDLE);
  if (idx < 0) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "var(--caution-text)" }}>{text.slice(idx, idx + NEEDLE.length)}</span>
      {text.slice(idx + NEEDLE.length)}
    </>
  );
}

export function ReviewSummary({
  count,
  overall,
  overallTen,
  percentRecommend,
  verifiedCount,
  dimensionsTen,
}: ReviewSummaryProps) {
  const { t, i18n } = useTranslation("reviews");
  const fmt1 = (v: number | null) =>
    v === null
      ? "—"
      : new Intl.NumberFormat(i18n.language, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(v);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          className="text-lg font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <BlockTitle text={t("block.title")} />
        </h2>
        {count > 0 ? (
          <span className="text-sm text-text-2">{t("block.count", { count })}</span>
        ) : null}
      </div>

      {count === 0 ? (
        <Card>
          <p className="text-sm text-text-2">{t("block.empty")}</p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span
              className="text-4xl leading-none font-bold text-ink-deep"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {fmt1(overall)}
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              <RatingBar value={overallTen} size="lg" ariaLabel={t("dim.overall")} />
              <div className="flex flex-col text-xs text-text-2">
                <span>{t("block.recommend", { percent: percentRecommend })}</span>
                {verifiedCount > 0 ? (
                  <span>{t("block.verifiedCount", { count: verifiedCount })}</span>
                ) : null}
              </div>
            </div>
          </div>

          <dl className="flex flex-col gap-2">
            {REVIEW_DIMENSIONS.map((dim) => (
              <div key={dim} className="flex items-center gap-3">
                <dt className="w-28 shrink-0 text-xs font-semibold text-text-2">
                  {t(`dim.${dim}`)}
                </dt>
                <RatingBar
                  value={dimensionsTen[dim]}
                  ariaLabel={`${t(`dim.${dim}`)}: ${fmt1(dimensionsTen[dim])}`}
                  className="flex-1"
                />
                <dd className="w-9 shrink-0 text-right text-xs font-bold text-petrol-text">
                  {fmt1(dimensionsTen[dim])}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </section>
  );
}
