/**
 * /deszkavalaszto — Deszkaválasztó (Advisor, F1.6). A catalog + reviews + advisor
 * modul összekötése KIZÁRÓLAG itt, a route-rétegben (1.3 modul-szerződés).
 *
 * POST→REDIRECT→GET (F1.10-utó): a wizard beküldése az `action`-be megy, ami
 * VALIDÁL és átirányít az eredmény-URL-re; a számítás a `loader`-ben történik a
 * query-paraméterekből. Korábban az eredmény kizárólag a POST-válasz törzsében
 * élt, aminek három látható következménye volt: újratöltésnél a böngésző
 * űrlap-újraküldést kért, a vissza-gomb után az eredmény elveszett, és nem
 * lehetett megosztani (a „Megosztás" gombnak nem is volt mit).
 *
 * A loader lépései:
 *   1) betölti a boardok + legolcsóbb ár + publikált vélemény-aggregátumokat,
 *   2) `BoardForAdvisor`-rá képezi (a modulok nem importálják egymást),
 *   3) `recommendBoards`-szal rangsorol,
 *   4) display-mezőkkel adja vissza a rangsort.
 */
import { useTranslation } from "react-i18next";
import { redirect } from "react-router";

import { recordEvent } from "@core/analytics/analytics.server";
import { getUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, pickTranslated, serverT } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";
import { SafetyNote } from "@core/ui";
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
  HEIGHT_RANGE,
  inputsFromSearchParams,
  searchParamsFromInputs,
} from "@modules/advisor/select/url";
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

function oneOf<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const EXPERIENCES: Experience[] = ["kezdo", "halado", "versenyzo"];
const PASSENGERS: Passenger[] = ["none", "child", "dog", "adult"];
const WATERS: WaterChoice[] = ["to", "folyo", "vedett"];
const USES: AdvisorUse[] = ["allround", "tura", "verseny", "joga", "horgasz"];
const STORAGES: StorageChoice[] = ["any", "inflatable_only"];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const locale = getLocaleFromPath(url.pathname);
  const t = serverT(locale, "advisor");
  const seo = buildPageSeo({
    request,
    locale,
    path: "/deszkavalaszto",
    title: t("seo.title"),
    description: t("seo.description"),
  });

  const { supabase } = createSupabaseServerClient(request);

  // A válaszok az URL-BEN vannak. Ha nincsenek (vagy hiányzik a testsúly), a
  // wizard jelenik meg — nem egy üres eredmény-lap.
  const inputs = inputsFromSearchParams(url.searchParams);
  if (!inputs) {
    // Tölcsér-ELEJE. A wizard-megjelenés és az eredmény-megjelenés aránya a
    // legfontosabb mérőszámunk: ebből látszik, hol esnek ki az emberek.
    await recordEvent(supabase, request, "advisor_wizard_view");
    return { seo, results: null, sizing: null, noMatchReason: null, water: null };
  }

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

  // A méret-illesztés az eredmény fejlécében látszik (különben a felhasználó
  // nem tudná, hogy a testadatai számítottak — a rész-pontok súlya kicsi).
  const sizing = {
    idealLengthCm: Math.round(idealLengthCm(inputs, config)),
    targetVolumeL: Math.round(targetVolumeL(inputs, config)),
    targetWidthCm: Math.round(targetWidthCm(inputs, config) * 10) / 10,
  };

  // Üres találatnál a VALÓDI kizárási okot adjuk vissza (ne vak tipp legyen).
  const noMatchReason =
    results.length === 0 ? explainNoMatch(boardsForAdvisor, inputs, config) : null;

  // Tölcsér-VÉGE. Megosztott linkből is idejut valaki — az is releváns
  // esemény, ezért nem az actionben mérünk (a session-log ott marad).
  await recordEvent(supabase, request, "advisor_result_view", {
    props: { water: inputs.water, experience: inputs.experience, matched: results.length },
  });

  // A víz-választás a megjelenítéshez is kell (folyón más póráz kell).
  return { seo, results, sizing, noMatchReason, water: inputs.water };
}

/**
 * A wizard beküldése: VALIDÁL és átirányít az eredmény-URL-re. A számítás a
 * loaderben történik, így az eredménynek saját, megosztható címe lesz.
 *
 * A session-logolás ITT marad, NEM a loaderben: egy megosztott linket sokan
 * megnyithatnak, és minden megnyitás új sort írna — az elemzés torzulna.
 */
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const weightKg = Number(formData.get("weightKg"));
  const heightRaw = formData.get("heightCm");
  const heightNum = typeof heightRaw === "string" ? Number(heightRaw) : NaN;
  const heightCm =
    Number.isFinite(heightNum) && heightNum >= HEIGHT_RANGE.min && heightNum <= HEIGHT_RANGE.max
      ? heightNum
      : null;
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

  // Best-effort session-log: a hibát elnyeljük, az ajánlás nem múlhat rajta.
  try {
    const { supabase } = createSupabaseServerClient(request);
    const user = await getUser(request);
    await supabase.from("advisor_sessions").insert({
      user_id: user?.id ?? null,
      inputs,
      results: [],
    });
  } catch {
    // ignoráljuk — a logolás nem blokkolhatja az ajánlást
  }

  throw redirect(`/deszkavalaszto?${searchParamsFromInputs(inputs).toString()}`);
}

export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

export default function AdvisorRoute({ loaderData }: Route.ComponentProps) {
  const { t: tCore } = useTranslation("core");

  if (loaderData.results) {
    return (
      <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <AdvisorResult
          results={loaderData.results}
          sizing={loaderData.sizing}
          noMatchReason={loaderData.noMatchReason}
        />
        {/* Aki folyóra választ deszkát, a PÓRÁZ-típusról is tudjon: sodró
            vízen a bokapóráz beakadhat. A szöveg a core namespace-ben él,
            mert a spot-adatlap is ezt mutatja (modul-szerződés). */}
        {loaderData.water === "folyo" ? (
          <SafetyNote title={tCore("safety.riverLeash.title")}>
            <p>{tCore("safety.riverLeash.body")}</p>
            <p className="mt-2">{tCore("safety.riverLeash.pfd")}</p>
          </SafetyNote>
        ) : null}
      </main>
    );
  }
  return <AdvisorWizard />;
}
