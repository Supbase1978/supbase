/**
 * Deszka-kártya a listához (`/deszkak`). Kép vagy token-placeholder + model,
 * márka, board_type-badge, méret-chipek, stabilitási index. A `@core/ui Card`-ra
 * épül; a link az adatlapra visz.
 */
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Card } from "@core/ui";

import type { BoardType } from "../types";

export interface BoardCardData {
  id: string;
  slug: string;
  modelName: string;
  brandName: string | null;
  boardType: BoardType;
  lengthCm: number | null;
  widthCm: number | null;
  volumeL: number | null;
  stabilityIndex: number | null;
  imageUrl: string | null;
}

export interface BoardCardProps {
  board: BoardCardData;
  className?: string;
}

export function BoardCard({ board, className }: BoardCardProps) {
  const { t } = useTranslation("catalog");

  return (
    <Card className={className}>
      <Link to={`/deszkak/${board.slug}`} className="flex flex-col gap-2.5">
        {board.imageUrl ? (
          <img
            src={board.imageUrl}
            alt={board.modelName}
            className="h-32 w-full rounded-[var(--radius-card)] object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-32 w-full rounded-[var(--radius-card)] bg-mist" aria-hidden="true" />
        )}

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold text-ink-deep">{board.modelName}</span>
          <span className="shrink-0 rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-text-2">
            {t(`boardType.${board.boardType}`)}
          </span>
        </div>

        {board.brandName ? (
          <span className="text-sm text-text-2">{board.brandName}</span>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {board.lengthCm && board.widthCm ? (
            <SpecChip text={`${board.lengthCm} × ${board.widthCm} cm`} />
          ) : null}
          {board.volumeL ? <SpecChip text={`${board.volumeL} l`} /> : null}
          {board.stabilityIndex !== null ? (
            <SpecChip text={`${t("spec.stabilityIndex")}: ${board.stabilityIndex}`} />
          ) : null}
        </div>
      </Link>
    </Card>
  );
}

function SpecChip({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-text-3 shadow-sm">
      {text}
    </span>
  );
}
