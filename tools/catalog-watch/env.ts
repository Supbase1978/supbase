/**
 * catalog-watch — a Supabase-cél feloldása és VÉDELME.
 *
 * MIÉRT VAN EZ A FÁJL (valós hiba, 2026-07-28): a gép shell-profilja
 * globálisan exportál `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` párost egy
 * RÉGI, IDEGEN projekthez (ugyanaz a csapda, amit a CLAUDE.md a Supabase CLI-nél
 * ír le a `SUPABASE_ACCESS_TOKEN`-nel). A figyelő első futása emiatt az idegen
 * projektre csatlakozott — olvasásnál ez csak hibaüzenet volt, de egy `crawl`
 * SZOLGÁLTATÓI KULCCSAL IDEGEN ADATBÁZISBA ÍRT VOLNA.
 *
 * Ezért a szabályok, ebben a sorrendben:
 *  1. A repo `.env`-je az AUTORITÁS. Ami ott van, az erősebb a shell-környezetnél
 *     (a `sb.sh` wrapper is így kényszeríti a helyes fiókot).
 *  2. A szolgáltatói kulcs `ref` claimjének EGYEZNIE kell a projekt-URL
 *     refjével — eltérésnél a futás LEÁLL, nem „valahogy" folytatódik.
 *  3. `.env` nélkül (GitHub Actions) a környezeti változók élnek: ott a secret
 *     szándékosan kerül a környezetbe, és nincs mit árnyékolni.
 */

/** `https://<ref>.supabase.co` → `<ref>`. Nem Supabase-URL-re null. */
export function projectRefFromUrl(url: string): string | null {
  const match = url.trim().match(/^https?:\/\/([a-z0-9]+)\.supabase\.(co|in|red)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * A klasszikus Supabase-kulcsok JWT-k, a payload `ref` claimje a projektet
 * azonosítja. Csak OLVASSUK (aláírást nem ellenőrzünk — nem hitelesítünk vele,
 * csak azt nézzük, melyik projekthez tartozik). Az újabb `sb_secret_…` kulcsok
 * nem hordoznak refet → null, ilyenkor nincs mit összevetni.
 */
export function refFromServiceKey(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(parts[1] as string, "base64url").toString("utf8"),
    );
    if (typeof payload !== "object" || payload === null) return null;
    const ref = (payload as { ref?: unknown }).ref;
    return typeof ref === "string" ? ref.toLowerCase() : null;
  } catch {
    return null;
  }
}

export interface SupabaseTarget {
  url: string;
  key: string;
  projectRef: string | null;
  /** Nem végzetes észrevételek (pl. árnyékoló shell-változó) — a CLI kiírja. */
  warnings: string[];
}

type Env = Record<string, string | undefined>;

/**
 * A cél-projekt és a szolgáltatói kulcs feloldása. Dob, ha hiányzik valami,
 * VAGY ha a kulcs nem ehhez a projekthez tartozik.
 */
export function resolveSupabaseTarget(dotEnv: Env, processEnv: Env): SupabaseTarget {
  const warnings: string[] = [];

  const url =
    dotEnv.VITE_SUPABASE_URL ??
    dotEnv.SUPABASE_URL ??
    processEnv.SUPABASE_URL ??
    processEnv.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Hiányzó Supabase-URL: tedd a repo .env-jébe (VITE_SUPABASE_URL), vagy add meg SUPABASE_URL-ként.",
    );
  }

  const fromDotEnv = dotEnv.VITE_SUPABASE_URL !== undefined || dotEnv.SUPABASE_URL !== undefined;
  const projectRef = projectRefFromUrl(url);
  const ambientRef = processEnv.SUPABASE_URL ? projectRefFromUrl(processEnv.SUPABASE_URL) : null;
  if (fromDotEnv && ambientRef !== null && ambientRef !== projectRef) {
    warnings.push(
      `A shell-környezet MÁS projektre mutat (SUPABASE_URL → ${ambientRef}), ` +
        `mint a repo .env-je (${projectRef ?? "ismeretlen"}). A .env győz.`,
    );
  }

  // A kulcs ugyanabból a forrásból jöjjön, mint az URL: ha a .env adja a
  // projektet, akkor a shell idegen projekthez tartozó kulcsát NEM vesszük át.
  const key = fromDotEnv
    ? (dotEnv.SUPABASE_SERVICE_ROLE_KEY ?? dotEnv.CATALOG_WATCH_SERVICE_KEY)
    : (processEnv.SUPABASE_SERVICE_ROLE_KEY ?? processEnv.CATALOG_WATCH_SERVICE_KEY);
  if (!key) {
    throw new Error(
      fromDotEnv
        ? "Hiányzó SUPABASE_SERVICE_ROLE_KEY a repo .env-jében. " +
          "(A shell-környezet kulcsát szándékosan NEM használjuk: az egy másik projekté lehet.)"
        : "Hiányzó SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const keyRef = refFromServiceKey(key);
  if (keyRef !== null && projectRef !== null && keyRef !== projectRef) {
    throw new Error(
      `A szolgáltatói kulcs MÁSIK projekthez tartozik (kulcs: ${keyRef}, cél: ${projectRef}). ` +
        "Futás leállítva — így nem írunk idegen adatbázisba.",
    );
  }

  return { url, key, projectRef, warnings };
}
