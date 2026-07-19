/**
 * /deszkak — deszka-lista (F1.5 váz). VÉKONY loader: boards + brand-join. A
 * komponens F1.4-mintára egyszerű kártya-rács; a ui-builder cseréli BoardCard-ra
 * (kép, ár-sáv, méret-chipek), lásd a TODO(ui-builder) kommenteket.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, pickTranslated } from "@core/i18n";
import { Card } from "@core/ui";
import { listBoards } from "@modules/catalog/data/boards.server";

import type { Route } from "./+types/deszkak";

export async function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);

  const boards = await listBoards(supabase);

  const items = boards.map((board) => ({
    id: board.id,
    slug: pickTranslated(board.slug, locale),
    modelName: board.model_name,
    brandName: board.brand?.name ?? null,
    boardType: board.board_type,
    lengthCm: board.length_cm,
    widthCm: board.width_cm,
    volumeL: board.volume_l,
    stabilityIndex: board.stability_index,
    imageUrl: board.image_url,
  }));

  return { items };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "[APPNÉV] — Deszkák" }];
};

export default function BoardsListRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("catalog");
  const { items } = loaderData;

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("list.title")}
        </h1>
        <p className="text-text-2">{t("list.lead")}</p>
      </header>

      {items.length === 0 ? (
        <p className="text-text-2">{t("list.empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              {/* TODO(ui-builder): BoardCard (kép-placeholder, ár-sáv,
                  méret-chipek, board_type-badge). */}
              <Card className="h-full">
                <Link to={`/deszkak/${item.slug}`} className="flex flex-col gap-2">
                  <div
                    className="h-32 w-full rounded-[var(--radius-card)] bg-mist"
                    aria-hidden="true"
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold text-ink-deep">{item.modelName}</span>
                    <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-text-2">
                      {t(`boardType.${item.boardType}`)}
                    </span>
                  </div>
                  {item.brandName ? (
                    <span className="text-sm text-text-2">{item.brandName}</span>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-xs text-text-3">
                    {item.lengthCm && item.widthCm ? (
                      <span>
                        {item.lengthCm} × {item.widthCm} cm
                      </span>
                    ) : null}
                    {item.volumeL ? <span>· {item.volumeL} l</span> : null}
                    {item.stabilityIndex !== null ? (
                      <span>· {t("spec.stabilityIndex")}: {item.stabilityIndex}</span>
                    ) : null}
                  </div>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
