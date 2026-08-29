/**
 * /alapinfo/:viz — egy víz SUP-szabály-, biztonság- és gyakorlati-infó
 * oldala. VÉKONY route: statikus tartalom,
 * nincs DB-lekérdezés — a zárt vízlista és az elem-számok a spots modulban
 * élnek (`src/modules/spots/waterinfo.ts`). Ismeretlen víz-slugra 404,
 * ugyanaz a minta, mint a catalog modul `felszereles.$kategoria.tsx`-e
 * (`isGearCategory` ⇄ `isWaterInfoSlug`).
 *
 * A biztonsági blokk (`SafetyNote`, semleges `sand` kiemelés — NEM a
 * `--safe`/`--caution`/`--danger` biztonsági tokenek, mert ez statikus
 * referencia-tartalom, nem élő állapotjelzés) ugyanazt a mintát követi, mint
 * a spot-adatlap folyó-póráz blokkja.
 *
 * A lista-elemek száma vizenként eltér, és a `t()` nem ad vissza
 * típusbiztosan tömböt (nincs i18next-resource-augmentáció) — ezért a
 * `WATER_INFO_COUNTS`-ból generált számozott kulcsokkal (`rules.0`, `rules.1`,
 * …) olvassuk be a listákat.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { recordEvent } from "@core/analytics/analytics.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, serverT } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";
import { Card, SafetyNote } from "@core/ui";
import {
  isWaterInfoSlug,
  LEGAL_BASIS_COUNT,
  STORM_TABLE_ROWS,
  WATER_INFO_COUNTS,
  type WaterInfoSlug,
} from "@modules/spots/waterinfo";

import type { Route } from "./+types/alapinfo.$viz";

export async function loader({ request, params }: Route.LoaderArgs) {
  const viz = params.viz;
  if (!viz || !isWaterInfoSlug(viz)) {
    throw new Response("Not Found", { status: 404 });
  }

  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);
  await recordEvent(supabase, request, "page_view");

  const t = serverT(locale, "spots");
  const waterTitle = t(`waterInfo.waters.${viz}.title`);
  const seo = buildPageSeo({
    request,
    locale,
    path: `/alapinfo/${viz}`,
    title: t("waterInfo.seo.detail.title", { water: waterTitle }),
    description: t("waterInfo.seo.detail.description", { water: waterTitle }),
  });

  return { seo, water: viz };
}

export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

function numberedList(
  t: (key: string) => string,
  base: string,
  count: number,
): string[] {
  return Array.from({ length: count }, (_, i) => t(`${base}.${i}`));
}

export default function WaterInfoDetailRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("spots");
  const water: WaterInfoSlug = loaderData.water;
  const counts = WATER_INFO_COUNTS[water];

  const base = `waterInfo.waters.${water}`;
  const rules = numberedList(t, `${base}.rules`, counts.rules);
  const safetyNotes = numberedList(t, `${base}.safetyNotes`, counts.safetyNotes);
  const practical = numberedList(t, `${base}.practical`, counts.practical);
  const legalBasis = counts.legalBasis
    ? numberedList(t, "waterInfo.legalBasis", LEGAL_BASIS_COUNT)
    : [];
  const safetyIntro = counts.stormTable ? t(`${base}.safetyIntro`) : null;

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <Link to="/alapinfo" className="text-sm font-semibold text-petrol-text underline">
          {t("waterInfo.detail.backToList")}
        </Link>
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t(`${base}.title`)}
        </h1>
        <p className="text-text-2">{t(`${base}.tag`)}</p>
      </header>

      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">
          {t("waterInfo.detail.rulesTitle")}
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-text-2">
          {rules.map((rule, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true">·</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
        {legalBasis.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-3">
              {t("waterInfo.detail.legalBasisTitle")}
            </span>
            <ul className="flex flex-col gap-0.5 text-xs text-text-3">
              {legalBasis.map((cite, i) => (
                <li key={i}>{cite}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <SafetyNote title={t("waterInfo.detail.safetyTitle")}>
        {safetyIntro ? <p>{safetyIntro}</p> : null}
        {counts.stormTable ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-text-3">
                  <th className="py-1.5 pr-3 font-semibold">
                    {t("waterInfo.stormTable.header.level")}
                  </th>
                  <th className="py-1.5 pr-3 font-semibold">
                    {t("waterInfo.stormTable.header.signal")}
                  </th>
                  <th className="py-1.5 font-semibold">
                    {t("waterInfo.stormTable.header.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {STORM_TABLE_ROWS.map((row) => (
                  <tr key={row} className="border-b border-line/60 align-top last:border-0">
                    <td className="py-1.5 pr-3 font-semibold text-ink-deep">
                      {t(`waterInfo.stormTable.${row}.level`)}
                    </td>
                    <td className="py-1.5 pr-3">{t(`waterInfo.stormTable.${row}.signal`)}</td>
                    <td className="py-1.5">{t(`waterInfo.stormTable.${row}.action`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <ul className="mt-2 flex flex-col gap-1">
          {safetyNotes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </SafetyNote>

      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">
          {t("waterInfo.detail.practicalTitle")}
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-text-2">
          {practical.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">
          {t("waterInfo.detail.relatedTitle")}
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <Link
              to="/felszereles/poraz"
              className="font-semibold text-petrol-text underline"
            >
              {t("waterInfo.detail.relatedLeash")}
            </Link>
          </li>
          <li>
            <Link
              to="/felszereles/mentomelleny"
              className="font-semibold text-petrol-text underline"
            >
              {t("waterInfo.detail.relatedPfd")}
            </Link>
          </li>
          <li>
            <Link to="/spotok" className="font-semibold text-petrol-text underline">
              {t("waterInfo.detail.relatedSpots")}
            </Link>
          </li>
        </ul>
      </Card>

      <p className="text-xs text-text-3">{t("waterInfo.detail.lastVerified")}</p>
    </main>
  );
}
