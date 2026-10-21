/**
 * A Deszkaválasztó adatbetöltése: boards + legolcsóbb ár + publikált vélemények
 * → `BoardForAdvisor[]`. A catalog+reviews+advisor összekötése route-rétegben él
 * (1.3 modul-szerződés); ezt használja a wizard-eredmény és a persona-landing is.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { listBoards, listCheapestPriceByBoard } from "@modules/catalog/data/boards.server";
import { computeReviewAggregate } from "@modules/reviews/aggregate";
import { listAllPublishedReviews } from "@modules/reviews/data/reviews.server";
import type { BoardForAdvisor } from "@modules/advisor/select/types";

export async function loadAdvisorCatalog(supabase: SupabaseClient) {
  const [boards, cheapest, publishedReviews] = await Promise.all([
    listBoards(supabase),
    listCheapestPriceByBoard(supabase),
    listAllPublishedReviews(supabase),
  ]);

  // Vélemények boardonként → Közös nevező-aggregátum.
  const reviewsByBoard = new Map<string, typeof publishedReviews>();
  for (const review of publishedReviews) {
    const list = reviewsByBoard.get(review.board_id) ?? [];
    list.push(review);
    reviewsByBoard.set(review.board_id, list);
  }

  const boardsForAdvisor: BoardForAdvisor[] = boards.map((board) => {
    const agg = computeReviewAggregate(reviewsByBoard.get(board.id) ?? []);
    return {
      id: board.id,
      boardType: board.board_type,
      // A deszka MINDEN kategóriája (F2.1-utó-43). Üres tömb = a
      // `board_types` bevezetése előttről származó sor: onnan az egyértékű
      // besorolás az egyetlen elem.
      boardTypes: board.board_types.length > 0 ? board.board_types : [board.board_type],
      volumeL: board.volume_l,
      widthCm: board.width_cm,
      lengthCm: board.length_cm,
      thicknessCm: board.thickness_cm,
      maxLoadKg: board.max_load_kg,
      inflatable: board.inflatable,
      modelYear: board.model_year,
      priceHuf: cheapest.get(board.id) ?? null,
      reviewAvg: agg.avgOverall,
      reviewCount: agg.count,
      ratingValueAvg: agg.perDimension.value,
    };
  });

  return { boards, cheapest, reviewsByBoard, boardsForAdvisor };
}
