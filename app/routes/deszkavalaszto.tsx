/**
 * /deszkavalaszto — Deszkaválasztó (Advisor, F1.6). A catalog + reviews + advisor
 * modul összekötése KIZÁRÓLAG itt, a route-rétegben (1.3 modul-szerződés). A
 * wizard kliens-oldali; a submit az `action`-be megy, ami:
 *   1) betölti a boardok + legolcsóbb ár + publikált vélemény-aggregátumokat,
 *   2) `BoardForAdvisor`-rá képezi (a modulok nem importálják egymást),
 *   3) `recommendBoards`-szal rangsorol,
 *   4) logol egy advisor_sessiont (anonim is), best-effort,
 *   5) visszaadja a rangsort display-mezőkkel.
 */
import { data } from "react-router";

import { getUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, pickTranslated, serverT } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";
import { listBoards, listCheapestPriceByBoard } from "@modules/catalog/data/boards.server";
import { computeReviewAggregate, toTen } from "@modules/reviews/aggregate";
import { listAllPublishedReviews } from "@modules/reviews/data/reviews.server";
import { loadAdvisorConfig } from "@modules/advisor/select/config.server";
import {
  explainNoMatch,
  idealLengthCm,
  recommendBoards,
  targetVolumeL,
  targetWidthCm,
} from "@modules/advisor/select/select";
import {
  ADVISOR_REVIEW_DIMENSIONS,
  type AdvisorDimensionScores,
  type AdvisorInputs,
  type AdvisorUse,
  type BoardForAdvisor,
  type Experience,
  type Passenger,
  type StorageChoice,
  type WaterChoice,
} from "@modules/advisor/select/types";
import { AdvisorResult, type AdvisorResultBoard } from "@modules/advisor/ui/AdvisorResult";
import { AdvisorWizard } from "@modules/advisor/ui/AdvisorWizard";

import type { Route } from "./+types/deszkavalaszto";

function oneOf<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const EXPERIENCES: Experience[] = ["kezdo", "halado", "versenyzo"];
const PASSENGERS: Passenger[] = ["none", "child", "dog"];
const WATERS: WaterChoice[] = ["to", "folyo", "vedett"];
const USES: AdvisorUse[] = ["allround", "tura", "verseny", "joga", "horgasz"];
const STORAGES: StorageChoice[] = ["any", "inflatable_only"];

export async function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const t = serverT(locale, "advisor");
  const seo = buildPageSeo({
    request,
    locale,
    path: "/deszkavalaszto",
    title: t("seo.title"),
    description: t("seo.description"),
  });
  return { locale, seo };
}

export async function action({ request }: Route.ActionArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase, headers } = createSupabaseServerClient(request);

  const formData = await request.formData();
  const weightKg = Number(formData.get("weightKg"));
  const heightRaw = formData.get("heightCm");
  const heightNum = typeof heightRaw === "string" ? Number(heightRaw) : NaN;
  // Ésszerű emberi tartomány; azon kívül/hiányzó → null (semleges hossz-illesztés).
  const heightCm =
    Number.isFinite(heightNum) && heightNum >= 120 && heightNum <= 220 ? heightNum : null;
  const budgetRaw = formData.get("budgetHuf");
  const budgetHuf =
    typeof budgetRaw === "string" && budgetRaw.trim() !== "" && Number.isFinite(Number(budgetRaw))
      ? Number(budgetRaw)
      : null;

  const inputs: AdvisorInputs = {
    weightKg: Number.isFinite(weightKg) ? weightKg : 0,
    heightCm,
    passenger: oneOf(formData.get("passenger"), PASSENGERS, "none"),
    experience: oneOf(formData.get("experience"), EXPERIENCES, "kezdo"),
    use: oneOf(formData.get("use"), USES, "allround"),
    water: oneOf(formData.get("water"), WATERS, "to"),
    budgetHuf,
    storage: oneOf(formData.get("storage"), STORAGES, "any"),
  };

  const [boards, cheapest, publishedReviews, user] = await Promise.all([
    listBoards(supabase),
    listCheapestPriceByBoard(supabase),
    listAllPublishedReviews(supabase),
    getUser(request),
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
      volumeL: board.volume_l,
      widthCm: board.width_cm,
      lengthCm: board.length_cm,
      thicknessCm: board.thickness_cm,
      maxLoadKg: board.max_load_kg,
      inflatable: board.inflatable,
      availabilityHu: board.availability_hu,
      modelYear: board.model_year,
      priceHuf: cheapest.get(board.id) ?? null,
      reviewAvg: agg.avgOverall,
      reviewCount: agg.count,
      ratingValueAvg: agg.perDimension.value,
    };
  });

  const config = await loadAdvisorConfig(supabase);
  const ranked = recommendBoards(boardsForAdvisor, inputs, config, 5);

  // Session-logolás (anonim is) — best-effort: a hibát elnyeljük, az eredmény megy.
  try {
    await supabase.from("advisor_sessions").insert({
      user_id: user?.id ?? null,
      inputs,
      results: ranked,
    });
  } catch {
    // ignoráljuk — a logolás nem blokkolhatja az ajánlást
  }

  const boardById = new Map(boards.map((b) => [b.id, b]));
  const results: AdvisorResultBoard[] = ranked.flatMap((item) => {
    const board = boardById.get(item.boardId);
    if (!board) return [];
    // Közös nevező az eredmény-kártyára: ugyanaz az aggregátum, amit az
    // algoritmus is használt, 10-es mércére váltva (a deszka-adatlappal egyező).
    const agg = computeReviewAggregate(reviewsByBoard.get(board.id) ?? []);
    return [
      {
        boardId: item.boardId,
        slug: pickTranslated(board.slug, locale),
        modelName: board.model_name,
        brandName: board.brand?.name ?? null,
        imageUrl: board.image_url,
        priceHuf: cheapest.get(board.id) ?? null,
        score: item.score,
        reasons: item.reasons,
        ratingTen: toTen(agg.avgOverall),
        reviewCount: agg.count,
        // Teljes bontás a kártyára: a felhasználó összehasonlíthasson anélkül,
        // hogy minden jelöltre át kellene kattintania.
        dimensionsTen: Object.fromEntries(
          ADVISOR_REVIEW_DIMENSIONS.map((dim) => [dim, toTen(agg.perDimension[dim])]),
        ) as AdvisorDimensionScores,
        percentRecommend: agg.percentRecommend,
      },
    ];
  });

  // A magasság-illesztés az eredmény fejlécében látszik (különben a felhasználó
  // nem tudná, hogy a válasza számított — a rész-pont súlya csak 10 %).
  const sizing = {
    idealLengthCm: Math.round(idealLengthCm(inputs, config)),
    targetVolumeL: Math.round(targetVolumeL(inputs, config)),
    targetWidthCm: Math.round(targetWidthCm(inputs, config) * 10) / 10,
  };

  // Üres találatnál a VALÓDI kizárási okot adjuk vissza (ne vak tipp legyen).
  const noMatchReason =
    results.length === 0 ? explainNoMatch(boardsForAdvisor, inputs, config) : null;

  return data({ results, sizing, noMatchReason }, { headers });
}

export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

export default function AdvisorRoute({ actionData }: Route.ComponentProps) {
  if (actionData?.results) {
    return (
      <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <AdvisorResult
          results={actionData.results}
          sizing={actionData.sizing}
          noMatchReason={actionData.noMatchReason}
        />
      </main>
    );
  }
  return <AdvisorWizard />;
}
