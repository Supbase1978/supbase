/**
 * Persona-landingek (F1.8b, programmatic SEO): előre kitöltött Deszkaválasztó-
 * helyzetek, amelyek a saját URL-jükön, indexelhető oldalként élnek.
 *
 * A számok és az ajánlott deszkák NEM kézzel írtak: a landing-route a példa-
 * bemenettel lefuttatja a valódi ajánlót, így az oldal együtt mozog az
 * algoritmussal és a katalógussal. A szövegek (cím, tippek) az `advisor`
 * namespace `persona.<slug>` alatt élnek.
 */
import type { AdvisorInputs } from "./select/types";

export const PERSONA_SLUGS = ["kezdo-100-kg-felett", "csaladi", "folyami"] as const;
export type PersonaSlug = (typeof PERSONA_SLUGS)[number];

export interface AdvisorPersona {
  slug: PersonaSlug;
  /** Szemléltető példa-bemenet — a landing ezzel számol. */
  inputs: AdvisorInputs;
}

export const ADVISOR_PERSONAS: readonly AdvisorPersona[] = [
  {
    slug: "kezdo-100-kg-felett",
    inputs: {
      weightKg: 105,
      heightCm: null,
      passenger: "none",
      experience: "kezdo",
      use: "allround",
      water: "to",
      budgetHuf: null,
      storage: "any",
    },
  },
  {
    slug: "csaladi",
    inputs: {
      weightKg: 80,
      heightCm: null,
      passenger: "child",
      experience: "kezdo",
      use: "allround",
      water: "vedett",
      budgetHuf: null,
      storage: "any",
    },
  },
  {
    slug: "folyami",
    inputs: {
      weightKg: 80,
      heightCm: null,
      passenger: "none",
      experience: "halado",
      use: "allround",
      water: "folyo",
      budgetHuf: null,
      storage: "any",
    },
  },
];

export function findPersona(slug: string | undefined): AdvisorPersona | null {
  return ADVISOR_PERSONAS.find((p) => p.slug === slug) ?? null;
}
