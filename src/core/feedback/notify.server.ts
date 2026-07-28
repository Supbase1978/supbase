/**
 * CORE: e-mail-értesítés új visszajelzésről (F2.2) — BEST-EFFORT.
 *
 * Az elsődleges tároló az ADATBÁZIS: a visszajelzés akkor is megvan, ha az
 * e-mail nem megy ki. Ez a modul csak annyit tesz, hogy szól róla — ezért
 * SOHA nem dob és sosem blokkolja a felhasználó válaszát.
 *
 * Kapcsoló: `RESEND_API_KEY` + `FEEDBACK_TO_EMAIL` szerver-oldali env. Amíg
 * nincs beállítva (a Resend-bekötés a `docs/RUNBOOK.md` élesítési
 * checklistjének egyik lépése), a függvény csendben kihagyja a küldést — nem
 * hiba, nem log-zaj.
 *
 * BIZTONSÁG: a levél a beküldött SZABAD SZÖVEGET tartalmazza, ezért minden
 * beillesztett érték HTML-escape-elve megy (a szöveg idegen bemenet).
 */
import type { FeedbackKind } from "./feedback.server";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Hibajelentés",
  shop: "Hiányzó bolt",
  board: "Hiányzó deszka-modell",
  idea: "Ötlet",
  other: "Egyéb",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export interface FeedbackNotification {
  kind: FeedbackKind;
  message: string;
  pagePath: string | null;
}

/** Az értesítés HTML-teste. Külön exportálva, hogy tesztelhető legyen. */
export function buildFeedbackEmailHtml(input: FeedbackNotification): string {
  const label = KIND_LABELS[input.kind];
  const page = input.pagePath ? escapeHtml(input.pagePath) : "—";
  return [
    `<h2>Suptime — ${escapeHtml(label)}</h2>`,
    `<p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    `<p><small>Beküldve innen: ${page}</small></p>`,
    `<p><small>Kezelés: /admin/visszajelzesek</small></p>`,
  ].join("\n");
}

/**
 * Értesítés küldése, ha be van kötve a Resend. A hívó NE várjon rá üzleti
 * eredményt: a visszatérés csak annyit mond, elment-e a kérés.
 */
export async function notifyFeedback(
  input: FeedbackNotification,
  env: Record<string, string | undefined> = process.env,
): Promise<{ sent: boolean }> {
  const apiKey = env.RESEND_API_KEY;
  const to = env.FEEDBACK_TO_EMAIL;
  const from = env.FEEDBACK_FROM_EMAIL ?? "Suptime <noreply@suptime.hu>";
  if (!apiKey || !to) {
    return { sent: false };
  }

  try {
    const subject = `[Suptime] ${KIND_LABELS[input.kind]}: ${input.message.slice(0, 60)}`;
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html: buildFeedbackEmailHtml(input) }),
    });
    return { sent: response.ok };
  } catch {
    // Az e-mail nem kritikus: a visszajelzés az adatbázisban már megvan.
    return { sent: false };
  }
}
