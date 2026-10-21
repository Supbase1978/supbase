/**
 * /deszkavalaszto/:persona — persona-landing (F1.8b, programmatic SEO).
 *
 * Egy előre kitöltött Deszkaválasztó-helyzet indexelhető oldala (pl. „SUP
 * kezdőknek 100 kg felett"). A méretek és az ajánlott deszkák a VALÓDI
 * ajánlóból jönnek a persona példa-bemenetével, így az oldal az algoritmussal
 * és a katalógussal együtt mozog. A catalog+reviews+advisor összekötése itt, a
 * route-rétegben történik (1.3 modul-szerződés).
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { recordEvent } from "@core/analytics/analytics.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { normalizedUrl } from "@core/http/request-url";
import { getLocaleFromPath, pickTranslated, serverT } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";
import { buttonClassName, Card, SafetyNote } from "@core/ui";
import { ADVISOR_PERSONAS, findPersona } from "@modules/advisor/personas";
import { loadAdvisorConfig } from "@modules/advisor/select/config.server";
import {
  idealLengthCm,
  recommendBoards,
  targetVolumeL,
  targetWidthCm,
} from "@modules/advisor/select/select";
import { searchParamsFromInputs } from "@modules/advisor/select/url";
import { cmToFeetInches } from "@modules/advisor/ui/format";

import { loadAdvisorCatalog } from "./deszkavalaszto.data.server";
import type { Route } from "./+types/deszkavalaszto.$persona";

const TOP_COUNT = 3;

export async function loader({ request, params }: Route.LoaderArgs) {
  const persona = findPersona(params.persona);
  if (!persona) {
    throw new Response("Not Found", { status: 404 });
  }

  const locale = getLocaleFromPath(normalizedUrl(request).pathname);
  const t = serverT(locale, "advisor");
  const seo = buildPageSeo({
    request,
    locale,
    path: `/deszkavalaszto/${persona.slug}`,
    title: t(`persona.${persona.slug}.seoTitle`),
    description: t(`persona.${persona.slug}.seoDescription`),
  });

  const { supabase } = createSupabaseServerClient(request);
  await recordEvent(supabase, request, "page_view");

  const [{ boards, boardsForAdvisor }, config] = await Promise.all([
    loadAdvisorCatalog(supabase),
    loadAdvisorConfig(supabase),
  ]);

  const boardById = new Map(boards.map((board) => [board.id, board]));
  const top = recommendBoards(boardsForAdvisor, persona.inputs, config, TOP_COUNT).flatMap(
    (item) => {
      const board = boardById.get(item.boardId);
      if (!board) return [];
      return [
        {
          slug: pickTranslated(board.slug, locale),
          modelName: board.model_name,
          brandName: board.brand?.name ?? null,
        },
      ];
    },
  );

  const sizing = {
    idealLengthCm: Math.round(idealLengthCm(persona.inputs, config)),
    targetVolumeL: Math.round(targetVolumeL(persona.inputs, config)),
    targetWidthCm: Math.round(targetWidthCm(persona.inputs, config) * 10) / 10,
  };

  return {
    seo,
    slug: persona.slug,
    inputs: persona.inputs,
    presetQuery: searchParamsFromInputs(persona.inputs).toString(),
    sizing,
    top,
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.seo ?? [];

export default function AdvisorPersonaRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("advisor");
  const { t: tCore } = useTranslation("core");
  const { slug, inputs, presetQuery, sizing, top } = loaderData;

  const tipsRaw = t(`persona.${slug}.tips`, { returnObjects: true });
  const tips = Array.isArray(tipsRaw) ? (tipsRaw as string[]) : [];

  const summaryParams = {
    weight: inputs.weightKg,
    level: t(`level.${inputs.experience}`),
    water: t(`water.${inputs.water}`),
    passenger: t(`passenger.${inputs.passenger}`),
  };
  const summary =
    inputs.passenger === "none"
      ? t("persona.exampleSummary", summaryParams)
      : t("persona.exampleWithPassenger", summaryParams);

  const otherPersonas = ADVISOR_PERSONAS.filter((p) => p.slug !== slug);

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t(`persona.${slug}.title`)}
        </h1>
        <p className="text-text-2">{t(`persona.${slug}.lead`)}</p>
      </header>

      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">{t("persona.exampleLabel")}</h2>
        <p className="font-medium text-text">{summary}</p>
        <h2 className="mt-2 text-lg font-semibold text-ink-deep">{t("persona.sizingTitle")}</h2>
        <p className="text-text-2">
          {t("result.sizing", {
            length: sizing.idealLengthCm,
            feet: cmToFeetInches(sizing.idealLengthCm),
            volume: sizing.targetVolumeL,
            width: sizing.targetWidthCm,
          })}
        </p>
        <p className="text-sm text-text-2">{t("persona.disclaimer")}</p>
      </Card>

      <section className="flex flex-col gap-2" aria-labelledby="persona-tips">
        <h2 id="persona-tips" className="text-lg font-semibold text-ink-deep">
          {t("persona.tipsTitle")}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-text-2">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      {slug === "folyami" ? (
        <SafetyNote title={tCore("safety.riverLeash.title")}>
          <p>{tCore("safety.riverLeash.body")}</p>
          <p className="mt-2">{tCore("safety.riverLeash.pfd")}</p>
        </SafetyNote>
      ) : null}

      <section className="flex flex-col gap-2" aria-labelledby="persona-top">
        <h2 id="persona-top" className="text-lg font-semibold text-ink-deep">
          {t("persona.topTitle")}
        </h2>
        {top.length === 0 ? (
          <p className="text-text-2">{t("persona.topNone")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {top.map((board) => (
              <li key={board.slug}>
                <Link
                  to={`/deszkak/${board.slug}`}
                  className="font-semibold text-petrol-text underline"
                >
                  {board.brandName ? `${board.brandName} ${board.modelName}` : board.modelName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to={`/deszkavalaszto?${presetQuery}`} className={buttonClassName("primary")}>
          {t("persona.ctaPreset")}
        </Link>
        <Link to="/deszkavalaszto" className={buttonClassName("outline")}>
          {t("persona.ctaOwn")}
        </Link>
      </div>

      <nav aria-labelledby="persona-more" className="flex flex-col gap-2">
        <h2 id="persona-more" className="text-lg font-semibold text-ink-deep">
          {t("persona.moreTitle")}
        </h2>
        <ul className="flex flex-col gap-1">
          {otherPersonas.map((p) => (
            <li key={p.slug}>
              <Link
                to={`/deszkavalaszto/${p.slug}`}
                className="font-semibold text-petrol-text underline"
              >
                {t(`persona.${p.slug}.title`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
