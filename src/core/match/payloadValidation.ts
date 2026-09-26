/**
 * Payload-Schemas je Ereignistyp (Brief Abschnitt 1) + `isPayloadValid`, der
 * Schritt-1-Check von applyEvent. Ausgelagert aus types.ts wegen der
 * 300-Zeilen-Grenze (`.claude/conventions/CODING.md`).
 */
import { z } from 'zod';
import { DETAIL_FIELDS } from './details';
import { MatchRulesSchema, type EngineEvent, type EventType, type MatchContext } from './types';

// Ruling K4 (Fixrunde 1, I5): kein Schema ist `.strict()` -- unbekannte Schlüssel werden
// ignoriert (z.object()-Default "strip"), nicht abgelehnt. Nur Pflichtfelder werden geprüft.
const EmptyPayloadSchema = z.object({});
const NonNegativeIntSchema = z.number().int().nonnegative();
/** C0a (V5): Spieler-ID steht in der Payload, kanonische kleingeschriebene UUID (wie S10). */
const LowerUuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
/** C0a (V1): optionale Angaben an Tor/Karte/Strafe/Foul/Wechsel -- gleiche Felder wie in `details`. */
const PlayerDetailFields = {
  playerNumber: NonNegativeIntSchema.optional(),
  playerId: LowerUuidSchema.optional(),
  assists: z.array(NonNegativeIntSchema).optional(),
  incomplete: z.boolean().optional(),
};
const OptionalPlayerPayloadSchema = z.object(PlayerDetailFields);
const TimePenaltyPayloadSchema = z.object({
  ...PlayerDetailFields,
  durationSeconds: z.number().int().positive().optional(),
});
const RetractPayloadSchema = z.object({});
const TeamScoresSchema = z.record(z.string(), z.number().int().nonnegative());
const CorrectionPayloadSchema = z.object({
  scores: TeamScoresSchema,
  reason: z.string().min(1),
  basedOn: z.string().nullable(),
});
const ResultEntryPayloadSchema = z.object({ scores: TeamScoresSchema });
const SkipPayloadSchema = z.object({ reason: z.string().optional() });
const ClockAdjustPayloadSchema = z.object({});
const TiebreakChoicePayloadSchema = z.object({ choice: z.enum(['overtime', 'goldenGoal', 'shootout']) });
const ShootoutKickPayloadSchema = z.object({
  scored: z.boolean(),
  shooterNumber: NonNegativeIntSchema.optional(),
  incomplete: z.boolean().optional(),
});
/**
 * C0a (D-C4, V1): AMEND. Mindestens ein Feld gesetzt oder ein nicht-leeres `clear`; kein Feld
 * zugleich gesetzt und in `clear`; `clear` nur bekannte Namen ohne Dubletten. Die Zulässigkeit je
 * Zieltyp prüft handlers/amend.ts (Schritt 5), weil sie das Ziel kennen muss.
 */
const AmendPayloadSchema = z
  .object({
    ...PlayerDetailFields,
    shooterNumber: NonNegativeIntSchema.optional(),
    clear: z.array(z.enum(['playerNumber', 'playerId', 'assists', 'shooterNumber', 'incomplete'])).optional(),
  })
  .refine((payload) => {
    const clear = payload.clear ?? [];
    const setFields = DETAIL_FIELDS.filter((field) => payload[field] !== undefined);
    return (
      (setFields.length > 0 || clear.length > 0) &&
      new Set(clear).size === clear.length &&
      !setFields.some((field) => clear.includes(field))
    );
  });
const MatchStartPayloadSchema = z.object({ rules: MatchRulesSchema });

export const PAYLOAD_SCHEMAS: Record<EventType, z.ZodType> = {
  MATCH_START: MatchStartPayloadSchema,
  PAUSE: EmptyPayloadSchema,
  RESUME: EmptyPayloadSchema,
  SECTION_END: EmptyPayloadSchema,
  SECTION_START: EmptyPayloadSchema,
  CLOCK_ADJUST: ClockAdjustPayloadSchema,
  MATCH_END: EmptyPayloadSchema,
  TIEBREAK_CHOICE: TiebreakChoicePayloadSchema,
  SHOOTOUT_KICK: ShootoutKickPayloadSchema,
  SHOOTOUT_END: EmptyPayloadSchema,
  RETRACT: RetractPayloadSchema,
  CORRECTION: CorrectionPayloadSchema,
  REOPEN: EmptyPayloadSchema,
  SKIP: SkipPayloadSchema,
  UNSKIP: EmptyPayloadSchema,
  RESULT_ENTRY: ResultEntryPayloadSchema,
  REVIEW_ACCEPT: EmptyPayloadSchema,
  REVIEW_DISCARD: EmptyPayloadSchema,
  GOAL: OptionalPlayerPayloadSchema,
  OWN_GOAL: OptionalPlayerPayloadSchema,
  YELLOW_CARD: OptionalPlayerPayloadSchema,
  YELLOW_RED_CARD: OptionalPlayerPayloadSchema,
  RED_CARD: OptionalPlayerPayloadSchema,
  TIME_PENALTY: TimePenaltyPayloadSchema,
  SUBSTITUTION: OptionalPlayerPayloadSchema,
  FOUL: OptionalPlayerPayloadSchema,
  AMEND: AmendPayloadSchema,
};

/** Ereignistypen, die zwingend ein `teamId` aus {teamAId, teamBId} brauchen. */
export const TEAM_REQUIRED_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  'GOAL',
  'OWN_GOAL',
  'YELLOW_CARD',
  'YELLOW_RED_CARD',
  'RED_CARD',
  'TIME_PENALTY',
  'FOUL',
  'SUBSTITUTION',
  'SHOOTOUT_KICK',
]);

/** Ereignistypen, deren Payload `scores` für GENAU beide Teams tragen muss. */
export const TEAM_SCORES_EVENT_TYPES: ReadonlySet<EventType> = new Set(['CORRECTION', 'RESULT_ENTRY']);

/** Ziel-Ereignistypen, die per RETRACT zurückgenommen werden dürfen (Brief Abschnitt 3). */
export const RETRACTABLE_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  'GOAL',
  'OWN_GOAL',
  'YELLOW_CARD',
  'YELLOW_RED_CARD',
  'RED_CARD',
  'TIME_PENALTY',
  'FOUL',
  'SUBSTITUTION',
  'CORRECTION',
  'SHOOTOUT_KICK',
]);

/**
 * Validiert Payload + kontextabhängige Pflichtfelder (teamId, targetId, clockMs) eines
 * Ereignisses. Reiner Struktur-Check -- Zustandsübergänge prüft applyEvent separat.
 */
export function isPayloadValid(event: EngineEvent, ctx: MatchContext): boolean {
  // Ruling S9 (B3b): ein unbekannter Ereignistyp (auch ein Prototyp-Name wie `constructor`) ist
  // INVALID_PAYLOAD statt einer Exception -- gleich wie der SQL-Zwilling (payload_valid, ELSE false).
  if (!Object.hasOwn(PAYLOAD_SCHEMAS, event.type)) {
    return false;
  }
  const schema = PAYLOAD_SCHEMAS[event.type];
  const parsed = schema.safeParse(event.payload);
  if (!parsed.success) {
    return false;
  }

  if (TEAM_REQUIRED_EVENT_TYPES.has(event.type)) {
    if (!event.teamId || (event.teamId !== ctx.teamAId && event.teamId !== ctx.teamBId)) {
      return false;
    }
  }

  if ((event.type === 'RETRACT' || event.type === 'AMEND') && !event.targetId) {
    return false;
  }

  if (event.type === 'CLOCK_ADJUST' && event.clockMs === null) {
    return false;
  }

  if (TEAM_SCORES_EVENT_TYPES.has(event.type)) {
    const scores = (parsed.data as { scores: Record<string, number> }).scores;
    const keys = Object.keys(scores);
    if (keys.length !== 2 || !keys.includes(ctx.teamAId) || !keys.includes(ctx.teamBId)) {
      return false;
    }
  }

  return true;
}
