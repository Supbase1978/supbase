/**
 * Deszka-kártya a listához (`/deszkak`). Kép vagy token-placeholder + model,
 * márka, board_type-badge, méret-chipek, stabilitási index. A `@core/ui Card`-ra
 * épül; a link az adatlapra visz.
 *
 * A kép a `ProductImage` FIX keretében ül: a kártyák egymás mellett állnak, és
 * a véleményezőnek a modellek KÖZÖTT kell eligazodnia — ehhez minden kártyán
 * azonos méretű, teljes egészében látszó termékkép kell (lásd `ProductImage`).
 */
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Card, ProductImage } from "@core/ui";

import { modelYearLabel } from "../model-years";
import type { BoardType } from "../types";

export interface BoardCardData {
  id: string;
  slug: string;
  modelName: string;
  brandName: string | null;
  /**
   * Melyik modellévekre érvényes ez a sor. Több elem = a gyártó több évben
   * AZONOS adattal hozta (`2024-2025`); ahol érdemben változott, ott
   * évjáratonként külön kártya áll. A modellnév maga NEM viseli az évet, hogy
   * egy forrása legyen az igazságnak.
   */
  modelYears: number[] | null;
  modelYear: number | null;
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
  const years = modelYearLabel(board.modelYears, board.modelYear);

  return (
    <Card className={className}>
      <Link to={`/deszkak/${board.slug}`} className="flex flex-col gap-2.5">
        <ProductImage src={board.imageUrl} alt={board.modelName} />

        {/*
          Telefonon a kártya egy KÉTOSZLOPOS rács fele (~170 px): ott a
          modellnév és a típus-badge egy sorban nem fér el, a név 3 sorra
          törne. Keskenyen tehát egymás alá kerülnek, `sm`-től marad az
          egysoros, jobbra igazított badge.
        */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
          <span className="text-base leading-snug font-semibold text-ink-deep sm:text-lg">
            {board.modelName}
            {years ? <span className="font-normal text-text-2"> ({years})</span> : null}
          </span>
          <span className="w-fit shrink-0 rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-text-2">
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
