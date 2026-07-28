/**
 * /admin/visszajelzesek — a beérkezett visszajelzések (F2.2).
 *
 * CORE admin-felület (nem modul-manifesztből jön), mint az F1.12 analitika:
 * a csatorna keresztmetszeti, a javaslatok több modult érintenek.
 *
 * Guard: `requireRole('admin')` a loaderben ÉS az actionben. Szándékosan ADMIN
 * és nem moderátor: a beküldött szöveg szabad szöveg, a csatorna a fejlesztőé.
 * Az RLS ugyanezt kényszeríti ki (a `feedback` táblát csak admin olvashatja).
 */
import { useTranslation } from "react-i18next";
import { data, Form, Link } from "react-router";

import { requireRole } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { APP_NAME } from "@core/brand";
import {
  FEEDBACK_STATUSES,
  isFeedbackStatus,
  listFeedback,
  setFeedbackStatus,
  type FeedbackStatus,
} from "@core/feedback/feedback.server";
import { Button, Card, StatusBadge } from "@core/ui";

import type { Route } from "./+types/admin.visszajelzesek";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const { supabase } = createSupabaseServerClient(request);

  const statusParam = new URL(request.url).searchParams.get("allapot") ?? "";
  const status: FeedbackStatus | undefined = isFeedbackStatus(statusParam)
    ? statusParam
    : undefined;

  const rows = await listFeedback(supabase, status ? { status } : {});
  return {
    activeStatus: status ?? null,
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      kind: row.kind,
      message: row.message,
      pagePath: row.page_path,
      status: row.status,
      adminNote: row.admin_note,
    })),
  };
}

type ActionResult = { ok: boolean };

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  const { supabase, headers } = createSupabaseServerClient(request);

  const formData = await request.formData();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "");

  if (!Number.isInteger(id) || !isFeedbackStatus(status)) {
    return data<ActionResult>({ ok: false }, { headers });
  }

  const result = await setFeedbackStatus(supabase, {
    id,
    status,
    adminNote,
    adminId: admin.id,
  });
  return data<ActionResult>(result, { headers });
}

export const meta: Route.MetaFunction = () => {
  return [{ title: `${APP_NAME} — Visszajelzések` }, { name: "robots", content: "noindex" }];
};

/** Állapot → biztonsági StatusBadge-szín. A `danger` itt tilos (nem veszély-jelzés). */
const STATUS_TONE: Record<FeedbackStatus, "safe" | "caution" | "stale"> = {
  new: "caution",
  in_progress: "caution",
  done: "safe",
  rejected: "stale",
};

export default function AdminFeedbackRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("core");
  const { items, activeStatus } = loaderData;

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("feedback.admin.title")}
        </h1>
        <p className="text-sm text-text-2">{t("feedback.admin.lead")}</p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label={t("feedback.admin.statusLabel")}>
        <FilterLink to="/admin/visszajelzesek" active={activeStatus === null}>
          {t("feedback.admin.filterAll")}
        </FilterLink>
        {FEEDBACK_STATUSES.map((status) => (
          <FilterLink
            key={status}
            to={`/admin/visszajelzesek?allapot=${status}`}
            active={activeStatus === status}
          >
            {t(`feedback.admin.status.${status}`)}
          </FilterLink>
        ))}
      </nav>

      {actionData?.ok ? <p className="text-sm text-text-2">{t("feedback.admin.saved")}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-text-2">{t("feedback.admin.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text">
                    {t(`feedback.kind.${item.kind}`)}
                  </span>
                  <StatusBadge
                    status={STATUS_TONE[item.status]}
                    label={t(`feedback.admin.status.${item.status}`)}
                  />
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm text-text">{item.message}</p>

                <p className="mt-2 text-xs text-text-3">
                  {new Date(item.createdAt).toLocaleString("hu-HU")}
                  {item.pagePath ? (
                    <>
                      {" · "}
                      {t("feedback.admin.fromPage")}:{" "}
                      <Link to={item.pagePath} className="text-petrol underline">
                        {item.pagePath}
                      </Link>
                    </>
                  ) : null}
                </p>

                <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-text">
                      {t("feedback.admin.statusLabel")}
                    </span>
                    <select
                      name="status"
                      defaultValue={item.status}
                      className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
                    >
                      {FEEDBACK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {t(`feedback.admin.status.${status}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
                    <span className="font-medium text-text">{t("feedback.admin.noteLabel")}</span>
                    <input
                      type="text"
                      name="adminNote"
                      defaultValue={item.adminNote ?? ""}
                      maxLength={2000}
                      className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
                    />
                  </label>
                  <Button type="submit" variant="secondary">
                    {t("feedback.admin.save")}
                  </Button>
                </Form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FilterLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={
        active
          ? "rounded-full bg-petrol px-3 py-1 text-sm text-surface"
          : "rounded-full border border-line px-3 py-1 text-sm text-text-2 hover:text-petrol-text"
      }
    >
      {children}
    </Link>
  );
}
