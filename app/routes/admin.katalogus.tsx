/**
 * /admin/katalogus — catalog-watch moderáció (catalog adminPanel, F2).
 *
 * Guard: `requireRole('moderator')` a loaderben ÉS az actionben (a jog-ellenőrzés
 * szerver-oldali, az RLS a védőháló — a `catalog_candidates` táblát csak
 * moderator/admin olvashatja/írhatja).
 *
 * EZ A KAPU. A piacfigyelő (`tools/catalog-watch`) soha nem hoz létre `boards`
 * sort: minden új típus ide, a jelölt-sorba érkezik, és emberi döntésből lesz
 * belőle katalógus-elem. Ugyanez igaz a kifutásra: a figyelő csak JELÖL, a
 * `discontinued` státuszt a moderátor erősíti meg.
 */
import { useTranslation } from "react-i18next";
import { data, Form } from "react-router";

import { requireRole } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { APP_NAME } from "@core/brand";
import { Button, Card, StatusBadge } from "@core/ui";
import {
  approveCandidate,
  listBoardChoices,
  listBoardsForLifecycle,
  listPendingCandidates,
  mergeCandidate,
  rejectCandidate,
  setBoardDiscontinued,
} from "@modules/catalog/data/candidates.server";
import { DEFAULT_UNSEEN_DAYS, findDiscontinuedCandidates } from "@modules/catalog/lifecycle";
import { BOARD_TYPES, type BoardType } from "@modules/catalog/types";

import type { Route } from "./+types/admin.katalogus";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "moderator");
  const { supabase } = createSupabaseServerClient(request);

  const [candidates, boardChoices, boards] = await Promise.all([
    listPendingCandidates(supabase),
    listBoardChoices(supabase),
    listBoardsForLifecycle(supabase),
  ]);

  return {
    candidates: candidates.map(({ candidate, sourceName, matchedBoardLabel }) => ({
      id: candidate.id,
      url: candidate.url,
      sourceName,
      matchedBoardId: candidate.matched_board_id,
      matchedBoardLabel,
      confidence: candidate.match_confidence,
      extracted: candidate.extracted,
    })),
    boardChoices,
    unseen: findDiscontinuedCandidates(boards),
    unseenDays: DEFAULT_UNSEEN_DAYS,
  };
}

type ActionResult = { ok: boolean; errorKey?: string };

function isBoardType(value: string): value is BoardType {
  return (BOARD_TYPES as readonly string[]).includes(value);
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "moderator");
  const { supabase, headers } = createSupabaseServerClient(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const boardId = String(formData.get("boardId") ?? "");

  let result: ActionResult = { ok: false, errorKey: "admin.error.updateFailed" };
  switch (intent) {
    case "approve": {
      const rawType = String(formData.get("boardType") ?? "");
      if (!isBoardType(rawType)) {
        result = { ok: false, errorKey: "admin.error.updateFailed" };
        break;
      }
      result = await approveCandidate(supabase, {
        candidateId,
        boardType: rawType,
        reviewerId: user.id,
      });
      break;
    }
    case "merge":
      result = boardId
        ? await mergeCandidate(supabase, { candidateId, boardId, reviewerId: user.id })
        : { ok: false, errorKey: "admin.error.noBoard" };
      break;
    case "reject":
      result = await rejectCandidate(supabase, { candidateId, reviewerId: user.id });
      break;
    case "discontinue":
      result = await setBoardDiscontinued(supabase, boardId, true);
      break;
    case "reactivate":
      result = await setBoardDiscontinued(supabase, boardId, false);
      break;
  }

  return data<ActionResult>(result, { headers });
}

export const meta: Route.MetaFunction = () => {
  // Admin-felület: nincs SEO-értéke, és a robots.txt is tiltja az /admin utat.
  return [{ title: `${APP_NAME} — Katalógus-moderáció` }, { name: "robots", content: "noindex" }];
};

export default function AdminCatalogRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("catalog");
  const { candidates, boardChoices, unseen, unseenDays } = loaderData;

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("admin.title")}
        </h1>
        <p className="text-sm text-text-2">{t("admin.lead")}</p>
      </header>

      {actionData ? (
        <p className={actionData.ok ? "text-sm text-text-2" : "text-sm text-caution-text"}>
          {actionData.ok ? t("admin.done") : t(actionData.errorKey ?? "admin.error.updateFailed")}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink-deep">{t("admin.pending")}</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-text-2">{t("admin.pendingEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <CandidateCard candidate={candidate} boardChoices={boardChoices} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink-deep">{t("admin.lifecycle")}</h2>
        <p className="text-sm text-text-2">{t("admin.lifecycleLead", { days: unseenDays })}</p>
        {unseen.length === 0 ? (
          <p className="text-sm text-text-2">{t("admin.lifecycleEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unseen.map((board) => (
              <li key={board.boardId}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text">{board.modelName}</span>
                    <StatusBadge
                      status="caution"
                      label={t("admin.daysUnseen", { days: board.daysUnseen })}
                    />
                  </div>
                  <div className="mt-2">
                    <IntentForm intent="discontinue" boardId={board.boardId}>
                      {t("admin.markDiscontinued")}
                    </IntentForm>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type LoaderCandidate = Awaited<ReturnType<typeof loader>>["candidates"][number];
type BoardChoice = { id: string; label: string };

function CandidateCard({
  candidate,
  boardChoices,
}: {
  candidate: LoaderCandidate;
  boardChoices: BoardChoice[];
}) {
  const { t } = useTranslation("catalog");
  const extracted = candidate.extracted;
  if (!extracted) {
    return null;
  }

  const title = [extracted.brandName, extracted.modelName].filter(Boolean).join(" ");
  const confidence =
    candidate.confidence === null ? null : `${Math.round(candidate.confidence * 100)}%`;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-ink-deep">{title || extracted.rawTitle}</h3>
        <span className="text-sm text-text-2">
          {extracted.priceHuf === null
            ? t("admin.noPrice")
            : `${extracted.priceHuf.toLocaleString("hu-HU")} Ft`}
        </span>
      </div>

      <p className="mt-1 text-xs text-text-3">{extracted.rawTitle}</p>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <SpecItem label={t("spec.length")} value={formatCm(extracted.specs.lengthCm)} />
        <SpecItem label={t("spec.width")} value={formatCm(extracted.specs.widthCm)} />
        <SpecItem label={t("spec.thickness")} value={formatCm(extracted.specs.thicknessCm)} />
        <SpecItem
          label={t("spec.volume")}
          value={extracted.specs.volumeL === null ? null : `${extracted.specs.volumeL} l`}
        />
        <SpecItem
          label={t("spec.maxLoad")}
          value={extracted.specs.maxLoadKg === null ? null : `${extracted.specs.maxLoadKg} kg`}
        />
        <SpecItem label={t("spec.year")} value={extracted.modelYear?.toString() ?? null} />
      </dl>

      <p className="mt-2 text-xs text-text-2">
        {t("admin.source")}: {candidate.sourceName ?? "—"}
        {confidence ? ` · ${t("admin.confidence")}: ${confidence}` : ""}
        {candidate.matchedBoardLabel
          ? ` · ${t("admin.suggestedMatch")}: ${candidate.matchedBoardLabel}`
          : ""}
      </p>

      {candidate.url ? (
        <p className="mt-1 text-xs">
          <a
            className="text-petrol underline"
            href={candidate.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t("admin.openSource")}
          </a>
        </p>
      ) : null}

      {/* Jóváhagyás — a típus a moderátoré (a figyelő tippje csak előválasztás). */}
      <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="intent" value="approve" />
        <input type="hidden" name="candidateId" value={candidate.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">{t("admin.typeLabel")}</span>
          <select
            name="boardType"
            defaultValue={extracted.boardType ?? "allround"}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
          >
            {BOARD_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`boardType.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary">
          {t("admin.approve")}
        </Button>
      </Form>
      <p className="mt-1 text-xs text-text-3">{t("admin.typeHint")}</p>

      {/* Összefésülés meglévő deszkába — a dupla-név elleni védelem. */}
      <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="intent" value="merge" />
        <input type="hidden" name="candidateId" value={candidate.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">{t("admin.mergeLabel")}</span>
          <select
            name="boardId"
            defaultValue={candidate.matchedBoardId ?? ""}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
          >
            <option value="">—</option>
            {boardChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary">
          {t("admin.merge")}
        </Button>
      </Form>

      <div className="mt-3">
        <IntentForm intent="reject" candidateId={candidate.id}>
          {t("admin.reject")}
        </IntentForm>
      </div>
    </Card>
  );
}

function SpecItem({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation("catalog");
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-text-3">{label}</dt>
      <dd className={value === null ? "text-text-3" : "text-text"}>
        {value ?? t("admin.unknown")}
      </dd>
    </div>
  );
}

function formatCm(value: number | null): string | null {
  return value === null ? null : `${Math.round(value)} cm`;
}

function IntentForm({
  intent,
  candidateId,
  boardId,
  children,
}: {
  intent: string;
  candidateId?: string;
  boardId?: string;
  children: React.ReactNode;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      {candidateId ? <input type="hidden" name="candidateId" value={candidateId} /> : null}
      {boardId ? <input type="hidden" name="boardId" value={boardId} /> : null}
      <Button type="submit" variant="ghost">
        {children}
      </Button>
    </Form>
  );
}
