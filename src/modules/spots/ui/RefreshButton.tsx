/**
 * "Frissítés most" gomb — kézi időjárás-frissítés kérése egy spotra.
 *
 * A backend (`requestSpotRefresh` / a `request_spot_refresh()` DB-függvény,
 * `20260717099800_spots_manual_refresh.sql`) spotonként 10 percig throttle-ol
 * és aszinkron hívja meg a `weather-sync` Edge Functiont — ÚJ
 * `weather_snapshots` sor csak néhány másodperc múlva jelenik meg. Ez a
 * komponens ezért `queued` válasz után ~6 és ~15 másodperccel revalidál
 * (legfeljebb kétszer) a `useRevalidator`-ral, hogy a friss adat megjelenjen
 * anélkül, hogy a felhasználónak kézzel újra kellene töltenie az oldalt.
 *
 * A route-action (`spotok.$slug.tsx`) dolgozza fel az `intent=refresh`
 * POST-ot és adja vissza a `{ refresh: SpotRefreshResult }` választ — ez a
 * komponens KIZÁRÓLAG a fetcher-küldést és az állapot-visszajelzést adja,
 * így újrafelhasználható a spot-kártyán (`SpotCard`) ÉS a spot-adatlapon is.
 *
 * A `queued` üzenet NEM maradhat kiírva örökre az után, hogy a revalidáció
 * lezajlott (a felhasználó szemszögéből megtévesztő lenne — a frissítés már
 * megtörtént, de a gomb még "indítva" szöveget mutatna): az ELSŐ ütemezett
 * revalidáció LEZÁRÁSA után "Frissítve" állapotra vált (`refresh.result.
 * updated`).
 *
 * TOKEN-SZABÁLY: petrol vonalas (`outline`) gomb — NEM amber CTA (nem
 * elsődleges cselekvés), NEM `--danger` (interakciós elemen tilos).
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher, useRevalidator } from "react-router";

import { buttonClassName, cx } from "@core/ui";

import type { SpotRefreshResult } from "../types";

export interface RefreshButtonProps {
  /** A spot URL-slugja (már locale-feloldva, a hívó loaderéből) — az action célja `/spotok/<slug>`. */
  slug: string;
  className?: string;
}

interface RefreshFetcherData {
  refresh: SpotRefreshResult;
}

/** A `queued` válasz után ennyi ms múlva revalidálunk (legfeljebb kétszer). */
const REVALIDATE_DELAYS_MS = [6_000, 15_000];

/** `SpotRefreshResult` → `spots` namespace eredmény-kulcs (not_found és unavailable közös szöveget kap). */
const RESULT_KEYS: Record<SpotRefreshResult, string> = {
  queued: "refresh.result.queued",
  fresh: "refresh.result.fresh",
  throttled: "refresh.result.throttled",
  not_found: "refresh.result.unavailable",
  unavailable: "refresh.result.unavailable",
};

/** A `queued` → "Frissítve" átváltás üzenet-kulcsa (lásd a fájl-fejléc kommentjét). */
const UPDATED_RESULT_KEY = "refresh.result.updated";

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.73-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13.5 2.5v3.8h-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RefreshButton({ slug, className }: RefreshButtonProps) {
  const { t } = useTranslation("spots");
  const fetcher = useFetcher<RefreshFetcherData>();
  const revalidator = useRevalidator();

  const busy = fetcher.state !== "idle";
  const result = fetcher.data?.refresh;

  // `queued` után, az ELSŐ revalidáció LEZÁRÁSAKOR "Frissítve"-re váltunk
  // (lásd a fájl-fejléc kommentjét) — új `queued` válasznál (új fetcherData-
  // azonosság) visszaáll, hogy a következő kör is "Frissítés elindítva"-val
  // kezdjen.
  const [justUpdated, setJustUpdated] = useState(false);

  // `queued`-nál a snapshot aszinkron íródik be — két revalidáció-kísérlet
  // ütemezve, unmountkor/új eredménynél törölve (nem szivároghat timer).
  const fetcherData = fetcher.data;
  useEffect(() => {
    if (fetcherData?.refresh !== "queued") return;
    setJustUpdated(false);
    let cancelled = false;
    const timers = REVALIDATE_DELAYS_MS.map((delay) =>
      setTimeout(() => {
        void revalidator.revalidate().then(() => {
          if (!cancelled) setJustUpdated(true);
        });
      }, delay),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // A revalidator-referencia React Router-stabil; csak az ÚJ `queued`
    // válasz (fetcherData-azonosság) indítson új ütemezést.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcherData]);

  const messageKey = justUpdated ? UPDATED_RESULT_KEY : result ? RESULT_KEYS[result] : null;

  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() =>
          fetcher.submit({ intent: "refresh" }, { method: "post", action: `/spotok/${slug}` })
        }
        className={buttonClassName("outline")}
      >
        <RefreshIcon />
        {busy ? t("refresh.pending") : t("refresh.cta")}
      </button>
      {messageKey ? (
        <p role="status" aria-live="polite" className="text-sm text-text-2">
          {t(messageKey)}
        </p>
      ) : null}
    </div>
  );
}
