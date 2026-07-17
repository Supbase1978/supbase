/**
 * GDPR self-service fiók-törlés váza (4. fejezet 7. pont).
 *
 * A tényleges törlést egy Supabase Edge Function (`delete-account`) végzi
 * `service_role` joggal, mert kliens-oldalról auth-user nem törölhető. A
 * követelmény két része:
 *   1) a felhasználó auth-rekordja törlődik;
 *   2) a `board_reviews` / `spot_reports` NEM törlődnek, hanem ANONIMIZÁLÓDNAK
 *      ("törölt felhasználó") — a Népítélet-aggregátumok így nem sérülnek.
 *
 * Az Edge Function + a hozzá tartozó SQL (anonimizáló UPDATE, majd auth-user
 * törlés) az F1.2+ feladata. Addig ez a váz beszédes `NotImplementedError`-ral
 * utasít el, hogy a UI beköthető legyen anélkül, hogy féltörlést kockáztatnánk.
 */

export const DELETE_ACCOUNT_FUNCTION = "delete-account";

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

/**
 * A törlés belépési pontja a kliensről. F1.2+-ban a törzse:
 *   const supabase = getSupabaseBrowserClient();
 *   const { error } = await supabase.functions.invoke(DELETE_ACCOUNT_FUNCTION);
 *   if (error) throw error;
 *   await supabase.auth.signOut();
 */
export async function deleteAccount(): Promise<never> {
  throw new NotImplementedError(
    "A fiók-törlés (GDPR) még nincs bekötve — a `delete-account` Edge Function " +
      "és a véleményeket anonimizáló SQL az F1.2+ feladata.",
  );
}
