/**
 * Viharjelzés-értesítés kapcsoló egy spotra (F1.9, 9./2.).
 *
 * KLIENS-OLDALI: a push-támogatás csak a böngészőben állapítható meg, ezért
 * SSR-en semmit nem renderel (nincs hydration-eltérés: az első kliens-render
 * után jelenik meg). A DB-írást nem maga végzi — a `WebPushProvider`-en át a
 * `/api/push` route ír, RLS alatt.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Button } from "@core/ui";

import { stormTopic } from "./types";
import { WebPushProvider } from "./web-push";

export interface PushToggleProps {
  /** A spot azonosítója — ez lesz a `storm:<spotId>` topic. */
  spotId: string;
  /** Van-e bejelentkezett felhasználó (a feliratkozás fiókhoz kötött). */
  isAuthenticated: boolean;
}

type ToggleState = "loading" | "off" | "on" | "denied" | "unsupported";

export function PushToggle({ spotId, isAuthenticated }: PushToggleProps) {
  const { t } = useTranslation("core");
  const [state, setState] = useState<ToggleState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topic = stormTopic(spotId);

  useEffect(() => {
    const provider = new WebPushProvider();
    if (!provider.isSupported()) {
      setState("unsupported");
      return;
    }
    if (provider.getPermission() === "denied") {
      setState("denied");
      return;
    }
    let cancelled = false;
    void provider
      .getSubscriptions()
      .then((subscriptions) => {
        if (cancelled) return;
        setState(subscriptions.some((s) => s.topic === topic) ? "on" : "off");
      })
      .catch(() => {
        if (!cancelled) setState("off");
      });
    return () => {
      cancelled = true;
    };
  }, [topic]);

  const toggle = useCallback(async () => {
    setBusy(true);
    setError(null);
    const provider = new WebPushProvider();
    try {
      if (state === "on") {
        await provider.unsubscribe(topic);
        setState("off");
      } else {
        await provider.subscribe(topic);
        setState("on");
      }
    } catch (err) {
      const key = err instanceof Error ? err.message : "push.saveFailed";
      if (key === "push.denied") {
        setState("denied");
      } else {
        // Ismeretlen kulcs → általános hiba (a kulcsokat az i18n fedi).
        setError(key.startsWith("push.") ? key : "push.saveFailed");
      }
    } finally {
      setBusy(false);
    }
  }, [state, topic]);

  // SSR-en és nem támogatott böngészőben nincs mit felajánlani.
  if (state === "unsupported") return null;

  if (!isAuthenticated) {
    return (
      <p className="text-sm text-text-3">
        <Link to="/belepes" className="font-semibold text-petrol-text underline">
          {t("push.loginLink")}
        </Link>{" "}
        {t("push.loginHint")}
      </p>
    );
  }

  if (state === "denied") {
    return <p className="text-sm text-text-3">{t("push.denied")}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={state === "on" ? "ghost" : "secondary"}
        onClick={() => void toggle()}
        disabled={busy || state === "loading"}
        aria-busy={busy}
      >
        {state === "on" ? t("push.disable") : t("push.enable")}
      </Button>
      <p className="text-xs text-text-3">
        {state === "on" ? t("push.enabledHint") : t("push.hint")}
      </p>
      {error ? (
        <p role="alert" className="text-xs text-caution-text">
          {t(error, { defaultValue: t("push.saveFailed") })}
        </p>
      ) : null}
    </div>
  );
}
