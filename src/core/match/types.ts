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

// M10 (Fixrunde 1): teamAId und teamBId müssen sich unterscheiden, sonst hat `scores` nur
// einen Schlüssel und Team-Zuordnung wird mehrdeutig. Wird von `initialState()` durchgesetzt.
export const MatchContextSchema = z
  .object({
    matchId: z.string().min(1),
    teamAId: z.string().min(1),
    teamBId: z.string().min(1),
  })
  .refine((ctx) => ctx.teamAId !== ctx.teamBId, {
    message: 'teamAId und teamBId müssen unterschiedlich sein',
    path: ['teamBId'],
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

/**
 * Ruling K1 (Fixrunde 1, C1/I1/I6): RESULT_ENTRY und CORRECTION bilden einen Stapel
 * "Überschreibungen" (nicht zurückgenommene, in Log-Reihenfolge). Jede Überschreibung
 * speichert `snapshot` = der aus Toren berechnete Stand zum Zeitpunkt ihrer Annahme. Der
 * effektive Stand ist dann die letzte Überschreibung plus die seitdem gefallenen Tore
 * (`effectiveScoreFor`). Damit zählen Tore nach REOPEN weiter, ohne dass eine Korrektur
 * verloren geht.
 */
export interface OverrideRecord {
  id: string;
  kind: 'correction' | 'direct';
  scores: Record<string, number>;
  snapshot: Record<string, number>;
  reason?: string;
  basedOn?: string | null;
  at: number;
  /** Log-Position bei Annahme (`state.nextSeq` vor dem Inkrement), für Ruling K9. */
  seq: number;
}

/** Ruling K5 (Fixrunde 1, I7): Tore merken sich ihre Phase, damit RETRACT in derselben Phase abzieht. */
export interface GoalRecord {
  id: string;
  scoringTeamId: string;
  phase: 'regular' | 'overtime';
  /** Log-Position bei Annahme (`state.nextSeq` vor dem Inkrement), für Ruling K9. */
  seq: number;
}

export interface MatchState {
  status: MatchStatus;
  phase: Phase;
  section: number;
  rules: MatchRules | null;
  clock: ClockState;
  scores: Record<string, TeamScoreBreakdown>;
  goals: GoalRecord[];
  overrides: OverrideRecord[];
  /** Monotoner Zähler für die Log-Position von Toren/Überschreibungen (Ruling K9). */
  nextSeq: number;
  /** Von der Spielende-Prüfung gesetzt ('regular'/'overtime'), REOPEN setzt es zurück auf null (K1). */
  baseDecidedBy: DecidedBy | null;
  shootoutKicks: ShootoutKickRecord[];
  cards: CardRecord[];
  fouls: FoulRecord[];
  penalties: PenaltyRecord[];
  substitutions: SubstitutionRecord[];
  accepted: Record<string, EngineEvent>;
  retracted: string[];
  lastScoreEventId: string | null;
  /** Abgeleitet über `decidedByFor()`, nach jedem Ereignis neu berechnet (applyEvent.ts). */
  decidedBy: DecidedBy | null;
  finishedAt: number | null;
}

/** Aus Toren berechneter Stand eines Teams, ohne Überschreibungen (regular+overtime). */
export function computedScoreFor(state: MatchState, teamId: string): number {
  const breakdown = state.scores[teamId];
  return breakdown ? breakdown.regular + breakdown.overtime : 0;
}

/**
 * Effektiver Stand eines Teams (Ruling K1): ohne Überschreibung der aus Toren berechnete
 * Stand, sonst die letzte Überschreibung zzgl. der seitdem gefallenen Tore (Snapshot-Delta).
 */
export function effectiveScoreFor(state: MatchState, teamId: string): number {
  const lastOverride = state.overrides[state.overrides.length - 1];
  if (!lastOverride) {
    return computedScoreFor(state, teamId);
  }
  const overrideValue = lastOverride.scores[teamId] ?? 0;
  const snapshotValue = lastOverride.snapshot[teamId] ?? 0;
  return overrideValue + (computedScoreFor(state, teamId) - snapshotValue);
}

/**
 * `decidedBy` aus dem Überschreibungs-Stapel ableiten (Ruling K1): letzte Überschreibung
 * bestimmt 'correction'/'direct', sonst gilt `baseDecidedBy` aus der Spielende-Prüfung.
 */
export function decidedByFor(state: MatchState): DecidedBy | null {
  const lastOverride = state.overrides[state.overrides.length - 1];
  if (lastOverride) {
    return lastOverride.kind === 'correction' ? 'correction' : 'direct';
  }
  return state.baseDecidedBy;
}

/** Liefert die "andere" Team-ID zu einem gegebenen Team im Kontext eines Spiels. */
export function otherTeamId(ctx: MatchContext, teamId: string): string {
  return teamId === ctx.teamAId ? ctx.teamBId : ctx.teamAId;
}
