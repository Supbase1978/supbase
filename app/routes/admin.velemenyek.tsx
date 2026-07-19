/**
 * /admin/velemenyek — vélemény-moderáció (reviews adminPanel, F1.5 váz).
 * Guard: requireRole('moderator') a loaderben ÉS az actionben (a jog-ellenőrzés
 * szerver-oldali; az RLS a védőháló). A ui-builder finomítja a listákat.
 */
import { useTranslation } from "react-i18next";
import { data, Form } from "react-router";

import { requireRole } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { Button, Card, StatusBadge } from "@core/ui";
import {
  listFlaggedReviews,
  listPendingReviews,
  resolveFlag,
  setReviewStatus,
  setVerifiedOwner,
} from "@modules/reviews/data/reviews.server";

import type { Route } from "./+types/admin.velemenyek";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "moderator");
  const { supabase } = createSupabaseServerClient(request);

  const [pending, flagged] = await Promise.all([
    listPendingReviews(supabase),
    listFlaggedReviews(supabase),
  ]);

  return {
    pending: pending.map((r) => ({
      id: r.id,
      ratingOverall: r.rating_overall,
      textPros: r.text_pros,
      textCons: r.text_cons,
      status: r.status,
      verifiedOwner: r.verified_owner,
    })),
    flagged: flagged.map((f) => ({
      id: f.review.id,
      ratingOverall: f.review.rating_overall,
      textPros: f.review.text_pros,
      textCons: f.review.text_cons,
      status: f.review.status,
      verifiedOwner: f.review.verified_owner,
      flags: f.flags.map((fl) => ({ id: fl.id, reason: fl.reason, note: fl.note })),
    })),
  };
}

type ActionResult = { ok: boolean };

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "moderator");
  const { supabase, headers } = createSupabaseServerClient(request);
  const user = await requireRole(request, "moderator");

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const reviewId = String(formData.get("reviewId") ?? "");
  const flagId = String(formData.get("flagId") ?? "");

  let result: { ok: boolean } = { ok: false };
  switch (intent) {
    case "hide":
      result = await setReviewStatus(supabase, reviewId, "hidden");
      break;
    case "unhide":
      result = await setReviewStatus(supabase, reviewId, "published");
      break;
    case "verify":
      result = await setVerifiedOwner(supabase, reviewId, true);
      break;
    case "unverify":
      result = await setVerifiedOwner(supabase, reviewId, false);
      break;
    case "resolveFlag":
      result = await resolveFlag(supabase, flagId, user.id);
      break;
  }

  return data<ActionResult>(result, { headers });
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "[APPNÉV] — Vélemény-moderáció" }];
};

export default function AdminReviewsRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("reviews");
  const { pending, flagged } = loaderData;

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <h1
        className="text-3xl font-semibold text-ink-deep"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("admin.title")}
      </h1>

      {/* Jóváhagyásra vár */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink-deep">{t("admin.pending")}</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-text-2">{t("admin.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((review) => (
              <li key={review.id}>
                <Card>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text">★ {review.ratingOverall}</span>
                    <StatusBadge status="caution" label={review.status} />
                  </div>
                  {review.textPros ? (
                    <p className="mt-2 text-sm text-text-2">{review.textPros}</p>
                  ) : null}
                  {review.textCons ? (
                    <p className="mt-1 text-sm text-text-3">{review.textCons}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ModButton intent="unhide" reviewId={review.id} label={t("admin.unhide")} />
                    <ModButton intent="hide" reviewId={review.id} label={t("admin.hide")} />
                    <ModButton
                      intent={review.verifiedOwner ? "unverify" : "verify"}
                      reviewId={review.id}
                      label={review.verifiedOwner ? t("admin.unverify") : t("admin.verify")}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Jelentett vélemények */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink-deep">{t("admin.flagged")}</h2>
        {flagged.length === 0 ? (
          <p className="text-sm text-text-2">{t("admin.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {flagged.map((review) => (
              <li key={review.id}>
                <Card>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text">★ {review.ratingOverall}</span>
                    <StatusBadge status="caution" label={review.status} />
                  </div>
                  {review.textPros ? (
                    <p className="mt-2 text-sm text-text-2">{review.textPros}</p>
                  ) : null}
                  <ul className="mt-2 flex flex-col gap-1">
                    {review.flags.map((flag) => (
                      <li key={flag.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-text-2">
                          {t("admin.reasonLabel")}: {t(`flag.reasonOption.${flag.reason}`)}
                          {flag.note ? ` — ${flag.note}` : ""}
                        </span>
                        <ModButton
                          intent="resolveFlag"
                          flagId={flag.id}
                          label={t("admin.resolveFlag")}
                        />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ModButton intent="hide" reviewId={review.id} label={t("admin.hide")} />
                    <ModButton intent="unhide" reviewId={review.id} label={t("admin.unhide")} />
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

function ModButton({
  intent,
  reviewId,
  flagId,
  label,
}: {
  intent: string;
  reviewId?: string;
  flagId?: string;
  label: string;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      {reviewId ? <input type="hidden" name="reviewId" value={reviewId} /> : null}
      {flagId ? <input type="hidden" name="flagId" value={flagId} /> : null}
      <Button type="submit" variant="secondary">
        {label}
      </Button>
    </Form>
  );
}
