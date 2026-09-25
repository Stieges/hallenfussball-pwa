/**
 * Lädt und validiert `matchTransitions.json` (Muster: Zod-Laden wie
 * `src/features/auth/utils/permissions.ts:25-71`). Wirft beim Modulstart laut,
 * wenn die JSON kaputt ist oder eine (from, type)-Kombination mehrfach
 * vorkommt -- ein Tippfehler soll sofort in Vitest auffallen statt still mit
 * falscher Semantik weiterzulaufen.
 */
import { z } from 'zod';
import matchTransitionsJson from './matchTransitions.json';
import { ActorSchema, EventTypeSchema, MatchStatusSchema, type Actor, type EventType, type MatchStatus } from './types';

export const TransitionRowSchema = z.object({
  from: MatchStatusSchema,
  type: EventTypeSchema,
  actor: ActorSchema,
  to: z.union([MatchStatusSchema, z.literal('='), z.literal('@endcheck')]),
});
export type TransitionRow = z.infer<typeof TransitionRowSchema>;

export const TransitionsFileSchema = z.object({
  $comment: z.string().optional(),
  transitions: z.array(TransitionRowSchema),
});
export type TransitionsFile = z.infer<typeof TransitionsFileSchema>;

/** Wirft, wenn (from, type) mehrfach vorkommt -- pro Zeilenpaar ist genau eine Zeile erlaubt. */
export function assertUniqueTransitionRows(rows: readonly TransitionRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.from}::${row.type}`;
    if (seen.has(key)) {
      throw new Error(`matchTransitions.json: doppelte Übergangszeile für (${row.from}, ${row.type})`);
    }
    seen.add(key);
  }
}

const parsedTransitionsFile = TransitionsFileSchema.parse(matchTransitionsJson);
assertUniqueTransitionRows(parsedTransitionsFile.transitions);

export const transitions: readonly TransitionRow[] = parsedTransitionsFile.transitions;

/** Sucht die Übergangszeile für (from, type). `undefined`, wenn keine Zeile existiert. */
export function findTransition(from: MatchStatus, type: EventType): TransitionRow | undefined {
  return transitions.find((row) => row.from === from && row.type === type);
}

/** Akteur-Semantik (R7): `helper`-Zeile erlaubt Helfer UND Turnierleitung. */
export function isActorAllowed(row: TransitionRow, actor: Actor): boolean {
  return row.actor === 'helper' || actor === 'leitung';
}
