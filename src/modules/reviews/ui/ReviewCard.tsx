/**
 * Egy vélemény kártyája a Közös nevező-blokk alatt. A hitelesített-tulajdonos
 * jelvény a core `StatusBadge safe` (szín + ikon + szöveg). A flag-affordanciát
 * (`FlagButton`) a hívó adja gyerekként — csak bejelentkezett, megerősített
 * usernek jelenik meg (a route dönti el).
 */
import type { ReactNode } from "react";

import { useTranslation } from "react-i18next";

import { Card, StatusBadge } from "@core/ui";

export interface ReviewCardData {
  id: string;
  /**
   * A szerző neve. `null` = törölt profil — ilyenkor a kártya a „törölt
   * felhasználó" feliratot mutatja, a vélemény viszont megmarad.
   */
  authorName: string | null;
  ratingOverall: number;
  textPros: string | null;
  textCons: string | null;
  verifiedOwner: boolean;
  createdAt: string;
}

export interface ReviewCardProps {
  review: ReviewCardData;
  /** Flag-affordancia (a route adja, ha a user jelenthet). */
  children?: ReactNode;
}

export function ReviewCard({ review, children }: ReviewCardProps) {
  const { t, i18n } = useTranslation("reviews");

  const date = new Date(review.createdAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(date);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        {/* A SZERZŐ NEVE (F2.4-02). Aki a saját neve alatt ír, máshogy ír —
            ez a gépi hozzászólások elleni védelem társas fele. */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">
            {review.authorName ?? t("deletedAuthor")}
          </span>
          {review.verifiedOwner ? (
            <StatusBadge status="safe" label={t("verifiedOwner")} />
          ) : null}
        </div>
        <span className="text-sm font-semibold text-text">★ {review.ratingOverall}</span>
      </div>

      {review.textPros ? <p className="text-sm text-text-2">{review.textPros}</p> : null}
      {review.textCons ? <p className="text-sm text-text-3">{review.textCons}</p> : null}

      <div className="flex items-center justify-between gap-2">
        {dateLabel ? <span className="text-xs text-text-3">{dateLabel}</span> : <span />}
        {children}
      </div>
    </Card>
  );
}
