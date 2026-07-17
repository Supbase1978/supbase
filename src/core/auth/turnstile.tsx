/**
 * Cloudflare Turnstile widget (4. fejezet 2. pont) — ÚJ npm-függőség NÉLKÜL.
 *
 * A hivatalos api.js scriptet dinamikusan töltjük be (explicit render módban),
 * a widgetet a komponens saját konténerébe rendereljük, unmountkor pedig
 * eltakarítjuk (`turnstile.remove`). A widget maga helyez el egy rejtett
 * inputot (`cf-turnstile-response`) — ezt a form beküldi, az action pedig
 * `options.captchaToken`-ként adja tovább a Supabase-nek (a SECRET-oldali
 * verifikáció Supabase Auth-beállítás, nem itt fut).
 *
 * Ha nincs SITE key (dev), a be/kikapcsolás EGYETLEN forrása az `env.ts`
 * (`isTurnstileEnabled`): a komponens vizuálisan jelzi, hogy a captcha ki van
 * kapcsolva, és a form használható marad.
 */
import { useEffect, useRef } from "react";

import { getTurnstileSiteKey, isTurnstileEnabled } from "./env";

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** A Turnstile által kitöltött rejtett input NEVE — az actionök innen olvassák. */
export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: "auto" | "light" | "dark";
  responseField?: boolean;
  responseFieldName?: string;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** A script betöltése egyszer, több widget esetén is megosztva. */
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Turnstile script betöltése sikertelen.")));
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("Turnstile script betöltése sikertelen.")));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileProps {
  /** Kikapcsolt (dev) állapot felirata — i18n-kulcsból, hardcode tilos. */
  disabledLabel: string;
  theme?: "auto" | "light" | "dark";
  className?: string;
}

export function Turnstile({ disabledLabel, theme = "auto", className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = getTurnstileSiteKey();

  useEffect(() => {
    if (!siteKey) {
      return;
    }
    let cancelled = false;

    void loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) {
        return;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        responseField: true,
        responseFieldName: TURNSTILE_RESPONSE_FIELD,
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme]);

  if (!isTurnstileEnabled()) {
    // Kikapcsolt captcha (dev): jelezzük, a form marad használható.
    return (
      <p className={className} data-turnstile="disabled" role="note">
        <span className="text-xs text-text-3">{disabledLabel}</span>
      </p>
    );
  }

  return <div ref={containerRef} className={className} data-turnstile="enabled" />;
}
