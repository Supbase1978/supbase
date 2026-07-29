/**
 * Kiegészítő-kártya a kategória-listához (`/felszereles/:kategoria`, F2.3 2.
 * szakasz). SZÁNDÉKOSAN külön komponens a `BoardCard`-tól (nem variánssal
 * bővítve): a kiegészítőnek nincs `board_type`-ja és stabilitási indexe, a
 * kártya olvashatóbb, ha ezt eleve nem tartalmazza, nem feltételekkel takarja el.
 */
import { Link } from "react-router";

import { Card } from "@core/ui";

import type { GearCategory } from "../gear";

export interface AccessoryCardData {
  id: string;
  slug: string;
  modelName: string;
  brandName: string | null;
  category: GearCategory;
  imageUrl: string | null;
}

export interface AccessoryCardProps {
  accessory: AccessoryCardData;
  className?: string;
}

export function AccessoryCard({ accessory, className }: AccessoryCardProps) {
  return (
    <Card className={className}>
      <Link
        to={`/felszereles/${accessory.category}/${accessory.slug}`}
        className="flex flex-col gap-2.5"
      >
        {accessory.imageUrl ? (
          <img
            src={accessory.imageUrl}
            alt={accessory.modelName}
            className="h-32 w-full rounded-[var(--radius-card)] object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-32 w-full rounded-[var(--radius-card)] bg-mist" aria-hidden="true" />
        )}

        <span className="text-lg font-semibold text-ink-deep">{accessory.modelName}</span>

        {accessory.brandName ? (
          <span className="text-sm text-text-2">{accessory.brandName}</span>
        ) : null}
      </Link>
    </Card>
  );
}
