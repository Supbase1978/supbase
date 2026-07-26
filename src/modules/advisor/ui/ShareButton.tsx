/**
 * Megosztás-gomb az ajánlás-eredményhez.
 *
 * ELŐZMÉNY: a gomb korábban ott volt, de NEM CSINÁLT SEMMIT (nem volt
 * `onClick`) — és nem is lett volna mit megosztania, mert az eredmény a
 * POST-válasz törzsében élt, saját URL nélkül. A POST→redirect→GET átállás
 * után az eredménynek van címe, tehát a megosztás értelmet nyert.
 *
 * MŰKÖDÉS, KÉT ÚTON:
 *  - `navigator.share` (mobil, újabb desktop): natív megosztó-lap.
 *  - vágólap-tartalék: a link másolása + visszajelzés.
 * Ha egyik sem elérhető (régi böngésző), a gomb NEM jelenik meg — jobb, mint
 * egy gomb, ami kattintásra semmit sem tesz (pontosan ez volt a hiba).
 *
 * SSR-BIZTOS: a képességvizsgálat csak `useEffect`-ben fut, mert a
 * `navigator` szerveren nem létezik.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@core/ui";

type ShareMode = "unsupported" | "native" | "clipboard";

export interface ShareButtonProps {
  /** Megosztandó cím (a natív lap ezt ajánlja fel). */
  title: string;
}

export function ShareButton({ title }: ShareButtonProps) {
  const { t } = useTranslation("advisor");
  const [mode, setMode] = useState<ShareMode>("unsupported");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.share === "function") {
      setMode("native");
    } else if (navigator.clipboard) {
      setMode("clipboard");
    }
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  if (mode === "unsupported") return null;

  const onShare = async () => {
    const url = window.location.href;
    try {
      if (mode === "native") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // A felhasználó megszakíthatja a natív megosztást (AbortError) — ez nem
      // hiba, és nem szabad hibaüzenetet mutatni rá.
    }
  };

  return (
    <Button type="button" variant="ghost" onClick={() => void onShare()}>
      {copied ? t("result.shareCopied") : t("result.share")}
    </Button>
  );
}
