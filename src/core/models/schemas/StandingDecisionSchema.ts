/**
 * Zod-Schema der Gleichstands-Entscheidung (Paket TB, Plan v2 § 3.2), strikt: unbekannte Felder werden abgelehnt.
 * Gespeichert im `tournaments.config`-JSONB (keine Migration). TB-3' (@W2A-072): Person, Zeitpunkt und Grund stehen nicht
 * mehr im öffentlich lesbaren config – Altwerte (`decidedBy`, `decidedAt`, `reason`) entfernt das Lesen, also auch das
 * nächste Schreiben; alles andere Unbekannte macht die Entscheidung weiter ungültig.
 */
import { z } from 'zod';

export const StandingDecisionSchema = z.strictObject({
  id: z.string().min(1),
  groupId: z.string(),
  teamIds: z.array(z.string().min(1)).min(2),
  order: z.array(z.string().min(1)).min(2),
  kind: z.enum(['shootout', 'order', 'shared']),
  shootout: z.strictObject({ winner: z.number().int().min(0), loser: z.number().int().min(0) }).optional(),
  basis: z.string(),
});

/** Frühere Felder mit Person, Zeit und Grund (vor TB-3'), die beim Lesen wegfallen. */
const LEGACY_PRIVATE_FIELDS = ['decidedBy', 'decidedAt', 'reason'] as const;

function withoutLegacyFields(item: unknown): unknown {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    return item;
  }
  return Object.fromEntries(Object.entries(item).filter(([key]) => !(LEGACY_PRIVATE_FIELDS as readonly string[]).includes(key)));
}

/** Gültige Entscheidungen aus beliebigem JSON; fehlerhafte fallen weg, ohne die übrigen zu gefährden. */
export function parseStandingDecisions(raw: unknown): z.infer<typeof StandingDecisionSchema>[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw.flatMap((item) => {
    const parsed = StandingDecisionSchema.safeParse(withoutLegacyFields(item));
    return parsed.success ? [parsed.data] : [];
  });
}
