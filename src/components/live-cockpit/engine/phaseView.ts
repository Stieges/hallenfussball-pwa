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
  /** Grenze des Abschnitts auf der Spieluhr (absolut, ms): Nullpunkt + Grenze. Damit endet der Abschnitt von selbst (B-08b). */
  limitClockMs: number;
  /** Wanduhr-Zeitpunkt (Serverzeit), an dem die laufende Uhr die Grenze erreicht; `null`, wenn die Uhr steht. */
  limitAt: number | null;
  /** Wie oft das Spiel nach dem Abpfiff wieder eröffnet wurde (trennt zwei Enden desselben Abschnitts). */
  reopenCount: number;
  isLastRegularSection: boolean;
  /** Restzeit der Abschnittspause, geklemmt auf 0; `null` außerhalb der Pause. */
  breakRemainingMs: number | null;
  /**
   * Restzeit der Quittung nach dem Abpfiff in ms (@SL-152, 30 Sekunden ab dem Abpfiff-Ereignis), geklemmt auf 0; `null`,
   * solange das Spiel nicht beendet ist (auch ausgefallen) oder der Abpfiff keine Zeit trägt.
   */
  quittungRestMs: number | null;
  /** Ganze gespielte Zeit über alle Abschnitte (Spieluhr, ohne Pausen), für die Tafel nach dem Ende (@SL-169). */
  playedMs: number;
  /** Ganze geplante Spielzeit: alle regulären Abschnitte, in der Verlängerung zusätzlich deren Dauer (@SL-169). */
  plannedMs: number;
  /** Kleinste zulässige Uhr im Abschnitt (relativ): spätester Eintrag des Abschnitts. */
  earliestAdjustMs: number;
  /** Der spätere Eintrag, der die Untergrenze setzt, ist ein Tor (für den Hinweis im Korrektur-Dialog, B-08d). */
  earliestAdjustIsGoal: boolean;
  penalties: PhasePenalty[];
  shootout: PhaseShootout | null;
  clockAdjustments: PhaseClockAdjustment[];
  /** Entscheidungsart der K.-o.-Runde; im Gruppenspiel `null`. */
  tiebreakMode: TiebreakMode | null;
  /**
   * @FU-112, @FU-115: ID des Ergebnis-Eintrags, mit dem die Turnierleitung das angepfiffene Spiel im Spielplan beendet hat
   * (Abpfiff und Ergebnis in einem Schritt); `null`, wenn das Spiel anders endete oder nicht beendet ist.
   */
  eingetragenImSpielplan: string | null;
}

/** Dauer der Quittung nach dem Abpfiff in ms (@SL-152): so lange steht die Zeile „Abgepfiffen · 2:1 gespeichert“. */
export const QUITTUNG_MS = 30_000;

/** Restzeit der Quittung; nur ein beendetes Spiel mit Abpfiff-Zeitpunkt hat eine (ausgefallen: `finishedAt` bleibt `null`). */
export function quittungRestOf(state: MatchState, serverNow: number): number | null {
  if (state.status !== 'finished' || state.finishedAt === null) {
    return null;
  }
  // nach oben auf 30 s begrenzt: liegt der Abpfiff durch eine fremde Geräteuhr in der Zukunft, steht die Zeile nicht länger
  return Math.min(QUITTUNG_MS, Math.max(0, QUITTUNG_MS - (serverNow - state.finishedAt)));
}

/** Geplante Gesamtzeit bis zum Ende des aktuellen Abschnitts-Typs: reguläre Abschnitte, in der Verlängerung dazu deren Dauer. */
function plannedMsOf(state: MatchState): number {
  const rules = state.rules;
  if (!rules) {
    return 0;
  }
  return (rules.sections * rules.sectionSeconds + (state.phase === 'overtime' ? rules.overtimeSeconds : 0)) * 1000;
}

/**
 * @FU-112: das Spiel wurde angepfiffen (Regeln aus dem Anpfiff) und endete mit einem Direkteintrag -- die letzte
 * Überschreibung ist `direct` und trägt den Zeitpunkt des Spielendes (nach einem späteren Abpfiff nicht mehr).
 */
export function eingetragenImSpielplanOf(state: MatchState): string | null {
  if (state.status !== 'finished' || !state.rules) {
    return null;
  }
  const last = state.overrides.at(-1);
  if (last?.kind !== 'direct' || last.at !== state.finishedAt) {
    return null;
  }
  return last.id;
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
    sectionElapsedMs: Math.max(0, elapsedMs - sectionBasisOf(state)),
    sectionLimitMs: sectionLimitOf(state),
    limitClockMs: sectionBasisOf(state) + sectionLimitOf(state),
    limitAt: limitAtOf(state),
    reopenCount: reopenCountOf(state),
    isLastRegularSection: state.section >= sections,
    breakRemainingMs,
    quittungRestMs: quittungRestOf(state, serverNow),
    playedMs: elapsedMs,
    plannedMs: plannedMsOf(state),
    earliestAdjustMs: earliestAdjustOf(state).ms,
    earliestAdjustIsGoal: earliestAdjustOf(state).isGoal,
    penalties: penaltiesOf(state, elapsedMs),
    shootout: shootoutOf(state, ctx),
    clockAdjustments: clockAdjustmentsOf(state),
    tiebreakMode: rules?.knockout ? state.tiebreakMode : null,
    eingetragenImSpielplan: eingetragenImSpielplanOf(state),
  };
}

/**
 * Nullpunkt der Abschnittszeit in ms. In der laufenden Verlängerung ist es die volle Sekunde des
 * Anpfiffs (`floor`), damit Tafel und Monitor die Sekunden im Gleichtakt zählen: `Basis + Grenze`
 * ist dann `viewDurationSeconds·1000` (Auto-Ende, #244). Sonst gilt `sectionStartMs`.
 */
function sectionBasisOf(state: MatchState): number {
  if (state.phase === 'overtime' && state.status !== 'section_break') {
    return Math.floor(state.sectionStartMs / 1000) * 1000;
  }
  return state.sectionStartMs;
}

/** Grenze des Abschnitts in ms, ab `sectionBasisOf` gezählt. */
function sectionLimitOf(state: MatchState): number {
  const rules = state.rules;
  if (!rules) {
    return 0;
  }
  return state.phase === 'overtime' ? rules.overtimeSeconds * 1000 : rules.sectionSeconds * 1000;
}

/** Wanduhr-Zeitpunkt der Grenze: nur bei laufender Uhr (`anchorAt` + Rest bis zur Grenze). */
function limitAtOf(state: MatchState): number | null {
  const clock = state.clock;
  if (state.status !== 'running' || !clock.running || clock.anchorAt === null) {
    return null;
  }
  return clock.anchorAt + (sectionBasisOf(state) + sectionLimitOf(state) - clock.elapsedMs);
}

/** Wirksame Wiedereröffnungen des Spiels (nicht zurückgenommen). */
function reopenCountOf(state: MatchState): number {
  return Object.values(state.accepted).filter((event) => event.type === 'REOPEN' && !state.retracted.includes(event.id)).length;
}

/** Spätester Uhrstand eines wirksamen Eintrags im aktuellen Abschnitt, relativ zum Abschnittsbeginn, mind. 0; `isGoal` für ein Tor. */
function earliestAdjustOf(state: MatchState): { ms: number; isGoal: boolean } {
  let latest: { clockMs: number; type: string } | null = null;
  for (const event of Object.values(state.accepted)) {
    if (
      NON_ENTRY_TYPES.has(event.type) ||
      state.retracted.includes(event.id) ||
      event.section !== state.section ||
      event.clockMs === null
    ) {
      continue;
    }
    if (latest === null || event.clockMs > latest.clockMs) {
      latest = { clockMs: event.clockMs, type: event.type };
    }
  }
  if (latest === null) {
    return { ms: 0, isGoal: false };
  }
  return { ms: Math.max(0, latest.clockMs - sectionBasisOf(state)), isGoal: latest.type === 'GOAL' };
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
