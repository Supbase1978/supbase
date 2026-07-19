/**
 * Vélemény-jelentés affordancia: alapból egy „Jelentés" gomb, ami lenyitja az
 * ok-választót + beküldést (kevésbé zajos, mint a mindig-látszó select). A
 * beküldés a `deszkak.$slug` route action-jére megy (`intent=flag`). A hívó
 * (route) csak bejelentkezett, megerősített usernek rendereli.
 */
import { useState } from "react";

import { useTranslation } from "react-i18next";
import { Form } from "react-router";

import { Button, cx } from "@core/ui";

import { REVIEW_FLAG_REASONS } from "../types";

export interface FlagButtonProps {
  reviewId: string;
}

export function FlagButton({ reviewId }: FlagButtonProps) {
  const { t } = useTranslation("reviews");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        {t("flag.action")}
      </Button>
    );
  }

  return (
    <Form
      method="post"
      className="flex flex-wrap items-center gap-2"
      onSubmit={() => setOpen(false)}
    >
      <input type="hidden" name="intent" value="flag" />
      <input type="hidden" name="reviewId" value={reviewId} />
      <select
        name="reason"
        aria-label={t("flag.reason")}
        defaultValue={REVIEW_FLAG_REASONS[0]}
        className={cx(
          "min-h-[var(--tap-min)] rounded-[var(--radius-card)] border border-line px-2 text-xs",
        )}
      >
        {REVIEW_FLAG_REASONS.map((reason) => (
          <option key={reason} value={reason}>
            {t(`flag.reasonOption.${reason}`)}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary">
        {t("flag.submit")}
      </Button>
    </Form>
  );
}
