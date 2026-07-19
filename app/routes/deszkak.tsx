/**
 * /deszkak — deszka-lista. VÉKONY loader: boards + brand-join; a komponens a
 * catalog `BoardCard`-jaiból komponál rácsot.
 */
import { useTranslation } from "react-i18next";

import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, pickTranslated } from "@core/i18n";
import { listBoards } from "@modules/catalog/data/boards.server";
import { BoardCard } from "@modules/catalog/ui/BoardCard";

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
              <BoardCard board={item} className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
