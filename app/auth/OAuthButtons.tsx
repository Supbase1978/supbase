/**
 * Közösségi belépés gombok (F1.8b) — Google + Apple. A gombok a `/auth/oauth`
 * action-route-ra POST-olnak (progressive enhancement: JS nélkül is működik),
 * ott indul a `signInWithOAuth`. A `redirectTo`-t a hívó oldal adja át.
 */
import { Form } from "react-router";

import { Button } from "@core/ui";

import { useAuthT } from "./auth-i18n";

export interface OAuthButtonsProps {
  redirectTo: string;
}

export function OAuthButtons({ redirectTo }: OAuthButtonsProps) {
  const t = useAuthT();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-text-3">
        <span className="h-px flex-1 bg-line" />
        {t("auth.common.or")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Form method="post" action="/auth/oauth" className="flex flex-col gap-2">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Button type="submit" name="provider" value="google" variant="secondary">
          {t("auth.oauth.continueGoogle")}
        </Button>
        <Button type="submit" name="provider" value="apple" variant="secondary">
          {t("auth.oauth.continueApple")}
        </Button>
      </Form>
    </div>
  );
}
