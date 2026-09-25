/**
 * Typen der reinen Spiel-Rechenfunktion (B1a).
 *
 * TS jetzt, SQL-Zwilling folgt in B3a (Ruling R1). Diese Datei legt Zustände,
 * Ereignistypen, Fehlercodes und den Zustandstyp `MatchState` fest, die App
 * nutzt nichts davon vor PR C. Payload-Zod-Schemas + Validierung stehen wegen
 * der 300-Zeilen-Grenze in `payloadValidation.ts`.
 *
 * @see .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B1a-brief.md
 * @see .superpowers/sdd/2026-09-25-pr-b-schreibweg/rulings.md (R1-R19)
 */
import { z } from 'zod';

// ============================================
// Zustände, Phasen, Akteure, Ereignistypen
// ============================================

export const MatchStatusSchema = z.enum([
  'scheduled',
  'running',
  'paused',
  'section_break',
  'decision_pending',
  'shootout',
  'finished',
  'skipped',
]);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const PhaseSchema = z.enum(['regular', 'overtime', 'shootout']);
export type Phase = z.infer<typeof PhaseSchema>;

export const ActorSchema = z.enum(['helper', 'leitung']);
export type Actor = z.infer<typeof ActorSchema>;

export const EventTypeSchema = z.enum([
  'MATCH_START',
  'PAUSE',
  'RESUME',
  'SECTION_END',
  'SECTION_START',
  'CLOCK_ADJUST',
  'MATCH_END',
  'TIEBREAK_CHOICE',
  'SHOOTOUT_KICK',
  'SHOOTOUT_END',
  'RETRACT',
  'CORRECTION',
  'REOPEN',
  'SKIP',
  'UNSKIP',
  'RESULT_ENTRY',
  'REVIEW_ACCEPT',
  'REVIEW_DISCARD',
  'GOAL',
  'OWN_GOAL',
  'YELLOW_CARD',
  'YELLOW_RED_CARD',
  'RED_CARD',
  'TIME_PENALTY',
  'SUBSTITUTION',
  'FOUL',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const DecidedBySchema = z.enum(['regular', 'overtime', 'goldenGoal', 'shootout', 'direct', 'correction']);
export type DecidedBy = z.infer<typeof DecidedBySchema>;

// ============================================
// Fehlercodes (applyEvent-Ablehnungen)
// ============================================

export const ERROR_CODES = {
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  FORBIDDEN_ACTOR: 'FORBIDDEN_ACTOR',
  UNKNOWN_TARGET: 'UNKNOWN_TARGET',
  ALREADY_RETRACTED: 'ALREADY_RETRACTED',
  STALE_BASE: 'STALE_BASE',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  MATCH_FINISHED: 'MATCH_FINISHED',
  NO_WINNER: 'NO_WINNER',
  DEPENDS_ON_REJECTED: 'DEPENDS_ON_REJECTED',
  ID_CONFLICT: 'ID_CONFLICT',
  NOT_CONTROLLER: 'NOT_CONTROLLER',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ============================================
// Regeln (MATCH_START.payload.rules, vom Server geschrieben -- R4)
// ============================================

export const MatchRulesSchema = z.object({
  sections: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  sectionSeconds: z.number().int().nonnegative(),
  breakSeconds: z.number().int().nonnegative(),
  knockout: z.boolean(),
  tiebreak: z.enum(['shootout', 'overtime-then-shootout', 'goldenGoal']).nullable(),
  overtimeSeconds: z.number().int().nonnegative(),
  shootersPerTeam: z.number().int().nonnegative(),
  suddenDeathAfter: z.number().int().nonnegative(),
  penaltySeconds: z.number().int().nonnegative(),
});
export type MatchRules = z.infer<typeof MatchRulesSchema>;

// ============================================
// Ereignis (EngineEvent)
// ============================================

export const EngineEventSchema = z.object({
  id: z.string().min(1),
  type: EventTypeSchema,
  actor: ActorSchema,
  actorUser: z.string().optional(),
  at: z.number().int(),
  section: z.number().int().nullable(),
  clockMs: z.number().int().nullable(),
  teamId: z.string().nullable().optional(),
  targetId: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()),
});
export type EngineEvent = z.infer<typeof EngineEventSchema>;

export const MatchContextSchema = z.object({
  matchId: z.string().min(1),
  teamAId: z.string().min(1),
  teamBId: z.string().min(1),
});
export type MatchContext = z.infer<typeof MatchContextSchema>;

// ============================================
// Zustand (MatchState)
// ============================================

export interface TeamScoreBreakdown {
  regular: number;
  overtime: number;
  shootout: number;
}

export interface ClockState {
  running: boolean;
  elapsedMs: number;
  anchorAt: number | null;
}

export interface CardRecord {
  id: string;
  type: 'YELLOW_CARD' | 'YELLOW_RED_CARD' | 'RED_CARD';
  teamId: string;
  playerNumber?: number;
  clockMs: number | null;
  section: number | null;
}

export interface FoulRecord {
  id: string;
  teamId: string;
  playerNumber?: number;
  clockMs: number | null;
  section: number | null;
}

export interface PenaltyRecord {
  id: string;
  teamId: string;
  playerNumber?: number;
  durationSeconds: number;
  clockMs: number | null;
  section: number | null;
}

export interface SubstitutionRecord {
  id: string;
  teamId: string;
  playerNumber?: number;
  clockMs: number | null;
  section: number | null;
}

export interface ShootoutKickRecord {
  id: string;
  teamId: string;
  scored: boolean;
  shooterNumber?: number;
}

export interface CorrectionRecord {
  id: string;
  scores: Record<string, number>;
  reason: string;
  basedOn: string | null;
  at: number;
}

export interface MatchState {
  status: MatchStatus;
  phase: Phase;
  section: number;
  rules: MatchRules | null;
  clock: ClockState;
  scores: Record<string, TeamScoreBreakdown>;
  correctedScores: Record<string, number> | null;
  shootoutKicks: ShootoutKickRecord[];
  cards: CardRecord[];
  fouls: FoulRecord[];
  penalties: PenaltyRecord[];
  substitutions: SubstitutionRecord[];
  corrections: CorrectionRecord[];
  accepted: Record<string, EngineEvent>;
  retracted: string[];
  lastScoreEventId: string | null;
  decidedBy: DecidedBy | null;
  finishedAt: number | null;
}

/** Effektiver Stand eines Teams: correctedScores falls gesetzt, sonst regular+overtime. */
export function effectiveScoreFor(state: MatchState, teamId: string): number {
  if (state.correctedScores) {
    return state.correctedScores[teamId] ?? 0;
  }
  const breakdown = state.scores[teamId];
  return breakdown ? breakdown.regular + breakdown.overtime : 0;
}

/** Liefert die "andere" Team-ID zu einem gegebenen Team im Kontext eines Spiels. */
export function otherTeamId(ctx: MatchContext, teamId: string): string {
  return teamId === ctx.teamAId ? ctx.teamBId : ctx.teamAId;
}
