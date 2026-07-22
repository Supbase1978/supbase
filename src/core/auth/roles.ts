/**
 * Jogosultsági szintek (4. fejezet 5. pont).
 *
 * `user` → tartalom írása · `moderator` → flag-ek kezelése, review elrejtése ·
 * `admin` → minden + advisor_weights hangolás. A hierarchia rendezett: egy
 * magasabb szint mindig lefedi az alacsonyabbat (`hasRole`).
 *
 * A szerep FORRÁSA az F1.2-től a `profiles` tábla lesz; addig (és a JWT-alapú
 * gyors ellenőrzéshez) a user `app_metadata.role` claim-jét olvassuk, VÉDETT
 * defaulttal (`user`) — ismeretlen/hiányzó claim SOHA nem ad emelt jogot.
 */
import type { User } from "@supabase/supabase-js";

export const roles = ["user", "moderator", "admin"] as const;

export type Role = (typeof roles)[number];

export const defaultRole: Role = "user";

/** Rendezett rang — a `hasRole` küszöb-összehasonlításhoz. */
const RANK: Record<Role, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
};

/** Típusőr ismeretlen forrásból (JWT-claim, DB-mező) érkező értékhez. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

/**
 * Igaz, ha a `userRole` legalább a `required` szintet eléri.
 * Pl. `hasRole("admin", "moderator") === true`, `hasRole("user", "admin") === false`.
 */
export function hasRole(userRole: Role, required: Role): boolean {
  return RANK[userRole] >= RANK[required];
}

/**
 * NEM AUTORITATÍV szerep-hint a JWT `app_metadata.role` claimből (védett
 * defaulttal). A jogosultsági döntés AUTORITATÍV forrása a `profiles.role`, amit
 * a `requireRole` a `current_user_role()` RPC-n át olvas (ugyanaz, mint az RLS)
 * — ez a függvény csak gyors, hálózat nélküli UI-hintekhez való, ahol az
 * esetleges JWT–profiles eltérés nem biztonsági kockázat. Auth-döntéshez TILOS.
 */
export function getUserRole(
  user: Pick<User, "app_metadata"> | null | undefined,
): Role {
  const claim = user?.app_metadata?.["role"];
  return isRole(claim) ? claim : defaultRole;
}
