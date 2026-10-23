/**
 * Zod-Schema der Gleichstands-Entscheidung (Paket TB, Plan v2 § 3.2), strikt: unbekannte Felder werden abgelehnt.
 * Gespeichert im `tournaments.config`-JSONB (keine Migration). TB-3' (@W2A-072): Person, Zeitpunkt und Grund stehen nicht
 * mehr im öffentlich lesbaren config – Altwerte (`decidedBy`, `decidedAt`, `reason`) entfernt das Lesen, also auch das
 * nächste Schreiben; alles andere Unbekannte macht die Entscheidung weiter ungültig.
 *
 * GA4 A-13b-S Punkt 7 (Auflage 8): Schema + `checkDraftFields` (decisions.ts) sind der Zwilling von
 * `match_engine.standing_decision_valid` (Migration `20261110_006`) – weder strenger noch lockerer als der Server.
 * Gleichlauf: `src/core/standings/__fixtures__/standing-decision-shapes.json`. Anforderungen: @W2A-048, @TM-147.
 */
import { z } from 'zod';
import { TeamIdSchema } from './MatchSlotSchema';

/** Länge in Zeichen wie Postgres `char_length` (Unicode-Zeichen, nicht UTF-16-Einheiten wie `String.length`). */
const charLength = (value: string): number => [...value].length;

/** Text mit `min`–`max` Zeichen, gezählt wie am Server. */
const textOfLength = (min: number, max: number) =>
  z.string().refine((value) => {
    const length = charLength(value);
    return length >= min && length <= max;
  }, `Text muss ${min}–${max} Zeichen lang sein`);

export const StandingDecisionSchema = z.strictObject({
  id: textOfLength(1, 100),
  groupId: textOfLength(0, 40),
  /** Team-IDs als UUID in Kleinschreibung (wie der Server); die Gleichheit mit `order` prüft `checkDraftFields`. */
  teamIds: z.array(TeamIdSchema).min(2),
  order: z.array(TeamIdSchema).min(2),
  kind: z.enum(['shootout', 'order', 'shared']),
  shootout: z.strictObject({ winner: z.number().int().min(0), loser: z.number().int().min(0) }).optional(),
  basis: textOfLength(0, 20000),
}).refine((decision) => decision.kind === 'shootout' || decision.shootout === undefined, {
  message: "Ein Ergebnis (shootout) gibt es nur bei kind 'shootout'",
  path: ['shootout'],
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
