/**
 * PhaseView (B-08a, GB5 Punkt 1): Abschnitt, Phase, Pausen-Restzeit, laufende Strafen, Strafstoßschießen,
 * Uhr-Korrekturen und Entscheidungsart aus dem Engine-Zustand. Rein, ohne React; die Zeit kommt als
 * `serverNow` herein. Szenarien: @FU-073, @FU-074, @FU-075, @SL-013, @SL-014, @SL-032, @SL-053, @SL-081, @SL-097.
 */
import {
  activePenalties,
  elapsedAt,
  penaltyRemainingMs,
  shootoutWinner,
  type MatchContext,
  type MatchState,
  type MatchStatus,
  type Phase,
  type TiebreakMode,
} from '../../../core/match';
import { viewDurationSeconds } from '../../../core/match/client/viewDuration';

export interface PhasePenalty {
  id: string;
  teamId: string;
  playerNumber?: number;
  remainingMs: number;
}

export interface PhaseShootout {
  kicks: Record<string, number>;
  goals: Record<string, number>;
  winner: string | null;
  nextTeam: string | null;
}

export interface PhaseClockAdjustment {
  id: string;
  section: number | null;
  clockMs: number;
  previousClockMs: number;
}

export interface PhaseView {
  status: MatchStatus;
  phase: Phase;
  /** Aktueller Abschnitt, 1-basiert; in der Verlängerung `sections + 1`. */
  section: number;
  sections: number;
  /** Gespielte Zeit im Abschnitt (Spieluhr seit `sectionStartMs`). */
  sectionElapsedMs: number;
  sectionLimitMs: number;
  isLastRegularSection: boolean;
  /** Restzeit der Abschnittspause, geklemmt auf 0; `null` außerhalb der Pause. */
  breakRemainingMs: number | null;
  /** Kleinste zulässige Uhr im Abschnitt (relativ): spätester Eintrag des Abschnitts. */
  earliestAdjustMs: number;
  penalties: PhasePenalty[];
  shootout: PhaseShootout | null;
  clockAdjustments: PhaseClockAdjustment[];
  /** Entscheidungsart der K.-o.-Runde; im Gruppenspiel `null`. */
  tiebreakMode: TiebreakMode | null;
}

/** Ereignistypen, die keine Uhr-Stellung eines Eintrags sind. */
const NON_ENTRY_TYPES = new Set(['RETRACT', 'AMEND']);

export function phaseViewOf(state: MatchState, ctx: MatchContext, serverNow: number): PhaseView {
  const rules = state.rules;
  const sections = rules?.sections ?? 1;
  const elapsedMs = elapsedAt(state.clock, serverNow);
  const breakRemainingMs =
    state.status === 'section_break' && rules
      ? Math.max(0, rules.breakSeconds * 1000 - (serverNow - (state.breakStartedAt ?? serverNow)))
      : null;
  return {
    status: state.status,
    phase: state.phase,
    section: state.section,
    sections,
    sectionElapsedMs: Math.max(0, elapsedMs - state.sectionStartMs),
    sectionLimitMs: sectionLimitOf(state),
    isLastRegularSection: state.section >= sections,
    breakRemainingMs,
    earliestAdjustMs: earliestAdjustOf(state),
    penalties: penaltiesOf(state, elapsedMs),
    shootout: shootoutOf(state, ctx),
    clockAdjustments: clockAdjustmentsOf(state),
    tiebreakMode: rules?.knockout ? state.tiebreakMode : null,
  };
}

/**
 * Grenze des Abschnitts in ms, gezählt ab `sectionStartMs`. Die Verlängerung rechnet wie
 * `viewDurationSeconds` (Auto-Ende, #244), damit beide dasselbe Ende haben; in der Pause vor der
 * Verlängerung gilt die volle Verlängerungsdauer.
 */
function sectionLimitOf(state: MatchState): number {
  const rules = state.rules;
  if (!rules) {
    return 0;
  }
  if (state.phase !== 'overtime') {
    return rules.sectionSeconds * 1000;
  }
  if (state.status === 'section_break') {
    return rules.overtimeSeconds * 1000;
  }
  return viewDurationSeconds(state) * 1000 - state.sectionStartMs;
}

/** Spätester Uhrstand eines wirksamen Eintrags im aktuellen Abschnitt, relativ zum Abschnittsbeginn, mind. 0. */
function earliestAdjustOf(state: MatchState): number {
  let latest: number | null = null;
  for (const event of Object.values(state.accepted)) {
    if (
      NON_ENTRY_TYPES.has(event.type) ||
      state.retracted.includes(event.id) ||
      event.section !== state.section ||
      event.clockMs === null
    ) {
      continue;
    }
    latest = latest === null ? event.clockMs : Math.max(latest, event.clockMs);
  }
  return latest === null ? 0 : Math.max(0, latest - state.sectionStartMs);
}

/** Laufende Strafen; bei beendetem Spiel keine (@SL-097). */
function penaltiesOf(state: MatchState, elapsedMs: number): PhasePenalty[] {
  if (state.status === 'finished') {
    return [];
  }
  return activePenalties(state, elapsedMs).map((penalty) => ({
    id: penalty.id,
    teamId: penalty.teamId,
    ...(penalty.playerNumber !== undefined ? { playerNumber: penalty.playerNumber } : {}),
    remainingMs: penaltyRemainingMs(penalty, elapsedMs),
  }));
}

function shootoutOf(state: MatchState, ctx: MatchContext): PhaseShootout | null {
  if (state.status !== 'shootout' && state.shootoutKicks.length === 0) {
    return null;
  }
  const teams = [ctx.teamAId, ctx.teamBId];
  const kicks: Record<string, number> = {};
  const goals: Record<string, number> = {};
  for (const teamId of teams) {
    const own = state.shootoutKicks.filter((kick) => kick.teamId === teamId);
    kicks[teamId] = own.length;
    goals[teamId] = own.filter((kick) => kick.scored).length;
  }
  const winner = shootoutWinner(state, ctx);
  // Die Reihenfolge wird nicht erzwungen (Engine); der Schütze wechselt, Gleichstand beginnt Team A.
  const nextTeam = winner !== null ? null : kicks[ctx.teamAId] <= kicks[ctx.teamBId] ? ctx.teamAId : ctx.teamBId;
  return { kicks, goals, winner, nextTeam };
}

/** Uhr-Stellungen aus dem Log (CLOCK_ADJUST, nicht zurückgenommen), in Log-Reihenfolge. */
function clockAdjustmentsOf(state: MatchState): PhaseClockAdjustment[] {
  const result: PhaseClockAdjustment[] = [];
  for (const event of Object.values(state.accepted)) {
    const previous = event.payload.previousClockMs;
    if (
      event.type !== 'CLOCK_ADJUST' ||
      state.retracted.includes(event.id) ||
      event.clockMs === null ||
      typeof previous !== 'number'
    ) {
      continue;
    }
    result.push({ id: event.id, section: event.section, clockMs: event.clockMs, previousClockMs: previous });
  }
  return result;
}
