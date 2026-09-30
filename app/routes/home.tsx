/**
 * `/` — kezdőlap (a design "Hajnali tótükör" 1a-signature-je, ld.
 * `_design-source/SUP Explorations.dc.html` 569–681. sor). A design a
 * "közeli spotok" szekciót geolokációra építi; ennek a platformnak NINCS
 * felhasználói helymeghatározása, ezért a szekció a legjobb AKTUÁLIS
 * SUP-index állapotú spotokat mutatja ("Vízkörülmények most" cím) — valós
 * adattal, nem kitalált/kényszerített állapot-variációval.
 *
 * VÉKONY loader: a spots+weather összekötés (1.3 modul-szerződés miatt a
 * spots-modul nem importálhat weathert) ugyanúgy a route-rétegben történik,
 * mint a `/spotok` testvér-route-on — az `evaluateSpotSnapshot` helper
 * SZÁNDÉKOSAN duplikált (lásd `app/routes/spotok.tsx` azonos kommentje).
 * Hasonlóképp a reviews+catalog összekötés (a `board_reviews.board_id` egy
 * deszkára VAGY kiegészítőre mutathat, F2.3 óta) is itt köt össze.
 */
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";

import { recordEvent } from "@core/analytics/analytics.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, localizePath, pickTranslated, serverT } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";
import { HomeTile } from "@core/ui";
import { getCatalogItemsByIds } from "@modules/catalog/data/boards.server";
import { listRecentPublishedReviews } from "@modules/reviews/data/reviews.server";
import { ReviewCard, type ReviewCardData } from "@modules/reviews/ui/ReviewCard";
import { listLatestSnapshots, listSpots } from "@modules/spots/data/spots.server";
import { SpotCard } from "@modules/spots/ui/SpotCard";
import type { SpotRow, SpotStatus, WeatherSnapshotRow } from "@modules/spots/types";
import { loadSupIndexConfig } from "@modules/weather/sup-index/config.server";
import type { SupIndexConfig } from "@modules/weather/sup-index/config";
import { evaluateSnapshot } from "@modules/weather/sup-index/reading";
import type { SupIndexInput } from "@modules/weather/sup-index/types";
// A csempe-adat a modulok registry-éből épül (1.3 modul-szerződés) — új
// modul + `tile` = új csempe, ehhez a fájlhoz nem kell nyúlni. Lásd
// `app/nav.tsx` `primaryNav`-mintáját.
import { buildHomeTiles } from "~/home-tiles";
import { modules } from "@modules/registry";

import type { Route } from "./+types/home";

const homeTiles = buildHomeTiles(modules);

/** Ennyi spot-kártya és ennyi vélemény-teaser fér el kényelmesen a kezdőlapon. */
const HOME_SPOT_LIMIT = 3;
const HOME_REVIEW_LIMIT = 3;

interface HomeSpotEvaluation {
  index: number;
  status: SpotStatus;
  stale: boolean;
  fetchedAt: string;
  flags: { offshoreWind: boolean; neoprene: boolean };
}

interface HomeSpotItem {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  waterType: SpotRow["water_type"];
  difficulty: SpotRow["difficulty"];
  evaluation: HomeSpotEvaluation | null;
}

/** Lásd a spotok.tsx azonos nevű helperének kommentjét — szándékos duplikáció. */
function evaluateSpotSnapshot(
  spot: Pick<SpotRow, "shore_bearing_deg" | "water_type">,
  snapshot: WeatherSnapshotRow,
  config: SupIndexConfig,
): HomeSpotEvaluation | null {
  const { wind_kmh, gust_kmh, wind_dir_deg } = snapshot;
  if (wind_kmh === null || gust_kmh === null || wind_dir_deg === null) {
    return null;
  }

  const input: SupIndexInput = {
    wind_kmh,
    gust_kmh,
    wind_dir_deg,
    water_temp_c: snapshot.water_temp_c,
    storm_level: snapshot.storm_level,
    shore_bearing_deg: spot.shore_bearing_deg,
    water_type: spot.water_type,
    river_alert_level: snapshot.river_alert_level ?? undefined,
  };

  const reading = evaluateSnapshot({ input, fetchedAt: snapshot.fetched_at, config });
  const forbidden = snapshot.storm_level === 2 || reading.result.flags.riverAlert === 3;
  const status: SpotStatus = forbidden ? "forbidden" : reading.result.status;

  return {
    index: reading.result.index,
    status,
    stale: reading.stale,
    fetchedAt: snapshot.fetched_at,
    flags: {
      offshoreWind: reading.result.flags.offshoreWind,
      neoprene: reading.result.flags.neoprene,
    },
  };
}

interface HomeReviewItem {
  data: ReviewCardData;
  itemName: string;
  itemHref: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);
  await recordEvent(supabase, request, "page_view");

  const spots = await listSpots(supabase);
  const [snapshots, config] = await Promise.all([
    listLatestSnapshots(supabase, spots.map((spot) => spot.id)),
    loadSupIndexConfig(supabase),
  ]);

  const evaluatedSpots: HomeSpotItem[] = spots.map((spot) => {
    const snapshot = snapshots.get(spot.id);
    const evaluation = snapshot ? evaluateSpotSnapshot(spot, snapshot, config) : null;
    return {
      id: spot.id,
      name: spot.name,
      slug: pickTranslated(spot.slug, locale),
      region: spot.region,
      waterType: spot.water_type,
      difficulty: spot.difficulty,
      evaluation,
    };
  });

  // A legjobb AKTUÁLIS index-szel rendelkező spotok elöl; adat nélküli spot hátrasorolva.
  const spotlightSpots = [...evaluatedSpots]
    .sort((a, b) => (b.evaluation?.index ?? -Infinity) - (a.evaluation?.index ?? -Infinity))
    .slice(0, HOME_SPOT_LIMIT);

  const recentReviewRows = await listRecentPublishedReviews(supabase, HOME_REVIEW_LIMIT);
  const catalogItems = await getCatalogItemsByIds(
    supabase,
    recentReviewRows.map((review) => review.board_id),
  );
  const itemById = new Map(catalogItems.map((item) => [item.id, item]));

  const recentReviews: HomeReviewItem[] = recentReviewRows.flatMap((review) => {
    const item = itemById.get(review.board_id);
    // A tétel időközben törölt/nem található → kihagyjuk (törött linket nem mutatunk).
    if (!item) {
      return [];
    }
    const slug = pickTranslated(item.slug, locale);
    const itemHref =
      item.kind === "board" ? `/deszkak/${slug}` : `/felszereles/${item.accessory_type}/${slug}`;

    return [
      {
        itemName: item.model_name,
        itemHref,
        data: {
          id: review.id,
          authorName: review.author?.display_name ?? null,
          ratingOverall: review.rating_overall,
          textPros: review.text_pros,
          textCons: null,
          verifiedOwner: review.verified_owner,
          createdAt: review.created_at,
        },
      },
    ];
  });

  const t = serverT(locale, "core");
  const seo = buildPageSeo({
    request,
    locale,
    path: "/",
    title: t("seo.home.title"),
    description: t("seo.home.description"),
  });

  return { spotlightSpots, recentReviews, seo };
}

// Locale-helyes SEO-meta a loaderből (F1.8): title/description/OG + canonical + hreflang.
export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

export default function Home({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("core");
  const { spotlightSpots, recentReviews } = loaderData;
  const locale = getLocaleFromPath(useLocation().pathname);

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-10 p-4 sm:p-6">
      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-ink-deep p-6 sm:p-8">
        <h1
          className="text-3xl font-semibold text-surface sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("home.hero.title")}
        </h1>
        <p className="max-w-prose text-surface/85">{t("home.hero.lead")}</p>
        <Link
          to="/deszkavalaszto"
          className="mt-2 inline-flex min-h-[var(--cta-height)] w-fit items-center justify-center rounded-[var(--radius-cta)] bg-amber px-6 font-bold text-text hover:brightness-95"
        >
          {t("home.hero.cta")} →
        </Link>
      </section>

      {/* Csemperács: mobilon a felső nav-sáv vége kilóg a képernyőről, ezért
          itt a hero alatt is elérhető minden szekció — a modulok registry-
          éből épül (1.3 modul-szerződés), lásd `app/home-tiles.ts`. */}
      <nav aria-label={t("home.tiles.label")}>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {homeTiles.map((tile) => (
            <li key={`${tile.namespace}:${tile.path}`} className="h-full">
              <HomeTile
                to={localizePath(tile.path, locale)}
                icon={tile.icon}
                title={t(tile.labelKey, { ns: tile.namespace })}
                description={t(tile.descriptionKey, { ns: tile.namespace })}
              />
            </li>
          ))}
        </ul>
      </nav>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2
            className="text-xl font-semibold text-ink-deep"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("home.spots.title")}
          </h2>
          <Link to="/spotok" className="text-sm font-semibold text-petrol-text underline">
            {t("home.spots.viewAll")} →
          </Link>
        </div>

        {spotlightSpots.length === 0 ? (
          <p className="text-text-2">{t("home.spots.empty")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spotlightSpots.map((item) => (
              <li key={item.id}>
                <SpotCard
                  spot={{
                    id: item.id,
                    name: item.name,
                    slug: item.slug,
                    region: item.region,
                    waterType: item.waterType,
                    difficulty: item.difficulty,
                  }}
                  evaluation={item.evaluation}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2
          className="text-xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("home.reviews.title")}
        </h2>

        {recentReviews.length === 0 ? (
          <p className="text-text-2">{t("home.reviews.empty")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentReviews.map((review) => (
              <li key={review.data.id}>
                <ReviewCard
                  review={review.data}
                  itemName={review.itemName}
                  itemHref={review.itemHref}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
