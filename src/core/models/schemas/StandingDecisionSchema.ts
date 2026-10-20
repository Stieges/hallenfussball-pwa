/**
 * Zod-Schema der Gleichstands-Entscheidung (Paket TB, Plan v2 § 3.2), strikt: unbekannte Felder werden abgelehnt.
 * Gespeichert im `tournaments.config`-JSONB (keine Migration).
 */
import { z } from 'zod';
import { DECISION_REASON_MAX_LENGTH } from '../../standings/decisions';

export const StandingDecisionSchema = z.strictObject({
  id: z.string().min(1),
  groupId: z.string(),
  teamIds: z.array(z.string().min(1)).min(2),
  order: z.array(z.string().min(1)).min(2),
  kind: z.enum(['shootout', 'order', 'shared']),
  shootout: z.strictObject({ winner: z.number().int().min(0), loser: z.number().int().min(0) }).optional(),
  reason: z.string().min(1).max(DECISION_REASON_MAX_LENGTH).optional(),
  decidedBy: z.strictObject({ userId: z.string(), name: z.string() }),
  decidedAt: z.string().min(1),
  basis: z.string(),
});

/** Gültige Entscheidungen aus beliebigem JSON; fehlerhafte fallen weg, ohne die übrigen zu gefährden. */
export function parseStandingDecisions(raw: unknown): z.infer<typeof StandingDecisionSchema>[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw.flatMap((item) => {
    const parsed = StandingDecisionSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}
