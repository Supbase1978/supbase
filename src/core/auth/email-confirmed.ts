/**
 * E-mail-megerősítés helper (4. fejezet 1. pont).
 *
 * Megerősítetlen fiók BÖNGÉSZHET, de nem írhat véleményt/jelentést. Ez a
 * helper a UX-réteg: gomb-tiltás, figyelmeztető sáv, "erősítsd meg az
 * e-mailed" üzenet. A tényleges KIKÉNYSZERÍTÉS szerver-oldalon, RLS +
 * security definer függvényen keresztül történik (F1.2, a dokumentáció
 * `auth.jwt()->>'email_confirmed_at' is not null` mintája) — a kliens-oldali
 * ellenőrzés önmagában SOHA nem elég, csak felhasználói visszajelzésre való.
 */
import type { User } from "@supabase/supabase-js";

export function isEmailConfirmed(
  user: Pick<User, "email_confirmed_at"> | null | undefined,
): boolean {
  return Boolean(user?.email_confirmed_at);
}
