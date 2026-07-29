/**
 * /felszereles/:kategoria — egy felszerelés-kategória útmutatója (F2.3 1.
 * szakasz). VÉKONY route: statikus tartalom, nincs DB-lekérdezés — a
 * kategória-lista és a biztonsági-forrás leképezés a catalog modulban él
 * (`src/modules/catalog/gear.ts`). Ismeretlen kategória-slugra 404.
 *
 * A biztonsági blokk (`SafetyNote`, semleges `sand` minta, F1.11b) forrása
 * kategóriánként eltér:
 *   - `poraz`/`mentomelleny`: a MEGLÉVŐ core `safety.riverLeash.*` kulcsokat
 *     használja (a spot-adatlap és a Deszkaválasztó ugyanezt mutatja — nem
 *     másoljuk, újra hasznosítjuk, lásd `gear.ts` kommentje);
 *   - `pumpa`/`szarazzsak`: saját `catalog` namespace-beli szöveg (nincs
 *     hozzájuk meglévő core-kulcs);
 *   - a többi kategóriának nincs biztonsági jellegű tartalma — nincs blokk.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { recordEvent } from "@core/analytics/analytics.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, pickTranslated, serverT } from "@core/i18n";
import { buildPageSeo } from "@core/seo/page-seo";
import { Card, SafetyNote } from "@core/ui";
import { listAccessories } from "@modules/catalog/data/boards.server";
import {
  CORE_SAFETY_SOURCE,
  isGearCategory,
  OWN_SAFETY_CATEGORIES,
  type GearCategory,
} from "@modules/catalog/gear";
import { AccessoryCard } from "@modules/catalog/ui/AccessoryCard";

import type { Route } from "./+types/felszereles.$kategoria";

export async function loader({ request, params }: Route.LoaderArgs) {
  const kategoria = params.kategoria;
  if (!kategoria || !isGearCategory(kategoria)) {
    throw new Response("Not Found", { status: 404 });
  }

  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);
  await recordEvent(supabase, request, "page_view");

  const accessories = await listAccessories(supabase, kategoria);

  const t = serverT(locale, "catalog");
  const seo = buildPageSeo({
    request,
    locale,
    path: `/felszereles/${kategoria}`,
    title: t("gear.seo.detail.title", { category: t(`gear.categories.${kategoria}.title`) }),
    description: t("gear.seo.detail.description", {
      category: t(`gear.categories.${kategoria}.title`),
    }),
  });

  return {
    seo,
    category: kategoria,
    products: accessories.map((a) => ({
      id: a.id,
      slug: pickTranslated(a.slug, locale),
      modelName: a.model_name,
      brandName: a.brand?.name ?? null,
      category: kategoria,
      imageUrl: a.image_url,
    })),
  };
}

export const meta: Route.MetaFunction = ({ data }) => data?.seo ?? [];

/** A biztonsági blokk melyik forrásból építkezik — a UI ez alapján dönt. */
function safetySourceFor(category: GearCategory): "core-leash" | "core-pfd" | "own" | null {
  const coreSource = CORE_SAFETY_SOURCE[category];
  if (coreSource === "leash") return "core-leash";
  if (coreSource === "pfd") return "core-pfd";
  if (OWN_SAFETY_CATEGORIES.includes(category)) return "own";
  return null;
}

export default function GearCategoryRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("catalog");
  const { t: tCore } = useTranslation("core");
  const { category, products } = loaderData;

  const safetySource = safetySourceFor(category);

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <Link to="/felszereles" className="text-sm font-semibold text-petrol-text underline">
          {t("gear.detail.backToList")}
        </Link>
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t(`gear.categories.${category}.title`)}
        </h1>
        <p className="text-text-2">{t(`gear.categories.${category}.short`)}</p>
      </header>

      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">{t("gear.detail.purposeTitle")}</h2>
        <p className="text-sm text-text-2">{t(`gear.categories.${category}.purpose`)}</p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">{t("gear.detail.buyingTitle")}</h2>
        <p className="text-sm text-text-2">{t(`gear.categories.${category}.buying`)}</p>
      </Card>

      {safetySource === "core-leash" ? (
        <SafetyNote title={tCore("safety.riverLeash.title")}>
          <p>{tCore("safety.riverLeash.body")}</p>
        </SafetyNote>
      ) : null}

      {safetySource === "core-pfd" ? (
        <SafetyNote title={t(`gear.categories.${category}.safety.title`)}>
          <p>{tCore("safety.riverLeash.pfd")}</p>
        </SafetyNote>
      ) : null}

      {safetySource === "own" ? (
        <SafetyNote title={t(`gear.categories.${category}.safety.title`)}>
          <p>{t(`gear.categories.${category}.safety.body`)}</p>
        </SafetyNote>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink-deep">{t("gear.detail.productsTitle")}</h2>
        {products.length === 0 ? (
          <Card>
            <p className="text-sm text-text-2">{t("gear.detail.productsEmpty")}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <AccessoryCard key={product.id} accessory={product} />
            ))}
          </div>
        )}
      </section>

      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">{t("gear.detail.relatedTitle")}</h2>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <Link to="/spotok" className="font-semibold text-petrol-text underline">
              {t("gear.detail.relatedSpots")}
            </Link>
          </li>
          <li>
            <Link to="/deszkavalaszto" className="font-semibold text-petrol-text underline">
              {t("gear.detail.relatedAdvisor")}
            </Link>
          </li>
        </ul>
      </Card>
    </main>
  );
}
