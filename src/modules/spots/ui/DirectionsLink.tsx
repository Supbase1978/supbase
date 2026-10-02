/**
 * "Útvonal" link a spot GPS-koordinátáihoz a térkép alatt.
 *
 * SSR-en és a kezdeti kliens-renderen MINDIG a Google Maps-linket adja (fail-
 * safe alapérték, nincs hydration-eltérés) — a tényleges UA-sniffelés csak
 * `useEffect`-ben fut (a `navigator` szerveren nem létezik), és Apple-
 * eszközön (iPhone/iPad/Mac) az Apple Maps-re vált.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { buildDirectionsUrl, type DirectionsPlatform } from "@core/geo/directions";
import { buttonClassName } from "@core/ui";

export interface DirectionsLinkProps {
  lat: number;
  lng: number;
  className?: string;
}

const APPLE_PLATFORM_PATTERN = /iPhone|iPad|iPod|Macintosh|Mac OS/;

function detectPlatform(): DirectionsPlatform {
  if (typeof navigator === "undefined") return "other";
  const platform = navigator.platform ?? "";
  const userAgent = navigator.userAgent ?? "";
  return APPLE_PLATFORM_PATTERN.test(platform) || APPLE_PLATFORM_PATTERN.test(userAgent)
    ? "apple"
    : "other";
}

function DirectionsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M2 9 L8 2 L14 9 L9.5 9 L9.5 14 L6.5 14 L6.5 9 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DirectionsLink({ lat, lng, className }: DirectionsLinkProps) {
  const { t } = useTranslation("spots");
  // Kezdeti érték mindig "other" (SSR-biztos) — a kliens-effekt oldja fel a
  // valódi platformot, ha Apple-eszköz.
  const [platform, setPlatform] = useState<DirectionsPlatform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <a
      href={buildDirectionsUrl(lat, lng, platform)}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClassName("outline", className)}
    >
      <DirectionsIcon />
      {t("map.directions")}
    </a>
  );
}
