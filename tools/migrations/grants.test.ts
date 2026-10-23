/**
 * Őrszem a Supabase 2026-10-30-i változásához: a `public` sémában létrehozott
 * táblákhoz/nézetekhez explicit `grant` kell, különben friss projekten, preview-
 * ágon és `supabase db reset` után a Data API "permission denied"-et ad.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "supabase", "migrations");

const sql = readdirSync(DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(DIR, file), "utf8"))
  .join("\n")
  // sorkommentek ki, hogy a magyarázó szöveg ne adjon téves találatot
  .replace(/--.*$/gm, "");

const createRe =
  /create\s+(?:or\s+replace\s+)?(?:materialized\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi;
const dropRe =
  /drop\s+(?:materialized\s+)?(?:table|view)\s+(?:if\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi;

const created = new Set(
  [...sql.matchAll(createRe)].flatMap((m) =>
    m[1] ? [m[1].toLowerCase()] : [],
  ),
);
for (const m of sql.matchAll(dropRe))
  if (m[1]) created.delete(m[1].toLowerCase());

const grantStatements = [
  ...sql.matchAll(/grant\s[^;]*?\bon\s+(?:table\s+)?[^;]*?;/gi),
].map((m) => m[0].toLowerCase());

describe("migrációk: explicit Data API grant", () => {
  it("talál táblákat (a regex él)", () => {
    expect(created.size).toBeGreaterThan(20);
  });

  it.each([...created].sort())("public.%s-hez van explicit grant", (name) => {
    const covered = grantStatements.some((stmt) =>
      stmt.includes(`public.${name}`),
    );
    expect(
      covered,
      `Hiányzó 'grant ... on public.${name} to ...' a migrációkban`,
    ).toBe(true);
  });
});
