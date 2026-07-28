/**
 * catalog-watch — robots.txt parse + engedély-ellenőrzés.
 *
 * A terv jogi/etikai kerete (2. pont): robots.txt tisztelet, udvarias crawl.
 * Ez a modul TISZTA (nincs I/O): a letöltött szöveget kapja, és eldönti, hogy
 * egy útvonal lekérhető-e.
 *
 * FAIL-SAFE IRÁNY: itt a „biztonságos" a TARTÓZKODÁS. A hiányzó robots.txt
 * (404) a szabvány szerint „minden engedélyezett" — de a NEM ELÉRHETŐ
 * robots.txt (hálózati hiba, 5xx) ismeretlen állapot, és olyankor a crawl.ts
 * kihagyja a forrást: inkább ne crawl-ozzunk, mint hogy tiltott utat kérjünk le.
 *
 * A szabály-illesztés a de-facto szabvány szerint:
 *   * a leghosszabb illeszkedő minta győz (Allow és Disallow között is),
 *   * azonos hossznál az Allow győz,
 *   * `*` = tetszőleges karaktersor, `$` = sor vége horgony,
 *   * üres `Disallow:` = minden engedélyezett.
 */

/** Egy user-agent csoport szabályai. */
export interface RobotsGroup {
  /** Kisbetűs user-agent minták (`*` = mindenki). */
  agents: string[];
  rules: { allow: boolean; pattern: string }[];
  crawlDelaySec: number | null;
}

export interface RobotsTxt {
  groups: RobotsGroup[];
  /** A `Sitemap:` direktívák (globálisak, csoporton kívüliek). */
  sitemaps: string[];
}

/** A crawler user-agent neve — a robots-illesztés és a HTTP fejléc is ezt használja. */
export const CRAWLER_USER_AGENT = "SuptimeCatalogBot";

/**
 * robots.txt szöveg → struktúra. Tolerál BOM-ot, CRLF-et, kommenteket,
 * és a szabvány szerint az ismeretlen direktívákat egyszerűen eldobja.
 */
export function parseRobotsTxt(text: string): RobotsTxt {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];

  let current: RobotsGroup | null = null;
  // Egymást követő User-agent sorok EGY csoportot alkotnak: amíg csak
  // agent-sorok jönnek, ugyanabba a csoportba gyűjtünk.
  let lastLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\uFEFF/, "").split("#")[0]?.trim() ?? "";
    if (line === "") continue;

    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastLineWasAgent) {
        current = { agents: [], rules: [], crawlDelaySec: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }

    lastLineWasAgent = false;

    if (field === "sitemap") {
      if (value !== "") sitemaps.push(value);
      continue;
    }
    if (!current) continue;

    if (field === "disallow") {
      // Üres Disallow = "semmi sincs tiltva" — nem szabály, hanem annak hiánya.
      if (value !== "") current.rules.push({ allow: false, pattern: value });
    } else if (field === "allow") {
      if (value !== "") current.rules.push({ allow: true, pattern: value });
    } else if (field === "crawl-delay") {
      const sec = Number(value.replace(",", "."));
      if (Number.isFinite(sec) && sec >= 0) current.crawlDelaySec = sec;
    }
  }

  return { groups, sitemaps };
}

/**
 * A minket érintő csoport kiválasztása: pontos user-agent-egyezés előbbre való
 * a `*`-nál (szabvány). Nincs illeszkedő csoport → null (minden engedélyezett).
 */
export function groupForAgent(
  robots: RobotsTxt,
  userAgent = CRAWLER_USER_AGENT,
): RobotsGroup | null {
  const ua = userAgent.toLowerCase();
  let wildcard: RobotsGroup | null = null;
  let best: { group: RobotsGroup; length: number } | null = null;

  for (const group of robots.groups) {
    for (const agent of group.agents) {
      if (agent === "*") {
        wildcard ??= group;
        continue;
      }
      // A szabvány szerint elég, ha az agent-token a UA-név prefixe.
      if (ua.startsWith(agent) && (!best || agent.length > best.length)) {
        best = { group, length: agent.length };
      }
    }
  }
  return best?.group ?? wildcard;
}

/** robots-minta (`*`, `$`) → regex, minden más karakter literál. */
function patternToRegex(pattern: string): RegExp {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i] as string;
    if (ch === "*") source += ".*";
    else if (ch === "$" && i === pattern.length - 1) source += "$";
    else source += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + source);
}

/**
 * Engedélyezett-e az útvonal? A leghosszabb illeszkedő minta dönt; döntetlennél
 * az Allow. Szabály nélkül (vagy csoport nélkül) minden engedélyezett.
 */
export function isPathAllowed(
  robots: RobotsTxt,
  path: string,
  userAgent = CRAWLER_USER_AGENT,
): boolean {
  const group = groupForAgent(robots, userAgent);
  if (!group) return true;

  let decision: { allow: boolean; length: number } | null = null;
  for (const rule of group.rules) {
    if (!patternToRegex(rule.pattern).test(path)) continue;
    const length = rule.pattern.length;
    if (
      !decision ||
      length > decision.length ||
      (length === decision.length && rule.allow)
    ) {
      decision = { allow: rule.allow, length };
    }
  }
  return decision?.allow ?? true;
}

/** A ránk vonatkozó Crawl-delay másodpercben (nincs → null). */
export function crawlDelayFor(
  robots: RobotsTxt,
  userAgent = CRAWLER_USER_AGENT,
): number | null {
  return groupForAgent(robots, userAgent)?.crawlDelaySec ?? null;
}
