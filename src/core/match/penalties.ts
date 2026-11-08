/**
 * Zeitstrafen-Countdown (B1b, B-U5, TS-only -- R18: nicht im serverState, SQL rechnet das nicht).
 *
 * Die Strafe rechnet ausschließlich in Spieluhr-ms (R2): `elapsedMs` wächst nur bei laufender Uhr,
 * die Spieluhr ist kumulativ über Abschnitte und Verlängerung (B-U1). Damit läuft eine Strafe nur
 * mit laufender Uhr, über Abschnittspausen hinweg und in die Verlängerung hinein -- ohne
 * Sonderfall. Alle Werte sind Ganzzahl-ms.
 */
import type { ClockState, MatchState, PenaltyRecord } from './types';

const MS_PER_SECOND = 1000;
/** Dauer des Hinweises „darf sich ergänzen“ nach einem Gegentor, in Spielzeit (@SL-204). */
export const ERGAENZEN_HINWEIS_MS = 10_000;

/** Spielzeit zum Wanduhr-Zeitpunkt `at`: bei laufender Uhr `elapsedMs + (at − anchorAt)`, sonst `elapsedMs`. */
export function elapsedAt(clock: ClockState, at: number): number {
  if (!clock.running) {
    return clock.elapsedMs;
  }
  return clock.elapsedMs + (at - (clock.anchorAt ?? at));
}

/** Rest einer Strafe bei Spielzeit `elapsedMs`: `max(0, durationMs − max(0, elapsedMs − startMs))`. */
export function penaltyRemainingMs(penalty: PenaltyRecord, elapsedMs: number): number {
  return Math.max(0, penalty.durationMs - Math.max(0, elapsedMs - penalty.startMs));
}

/** Ein Tor für die Ableitung: wer gepunktet hat (Eigentor: der Gegner) und bei welcher Spielzeit. */
export interface PenaltyGoal {
  id: string;
  scoringTeamId: string;
  atMs: number;
}

/** Stand einer Strafe: Rest bei der betrachteten Spielzeit und das Tor, das sie beendet hat (sonst `null`). */
export interface PenaltyStatus {
  penalty: PenaltyRecord;
  remainingMs: number;
  endedByGoal: PenaltyGoal | null;
}

function remainingAtGoal(penalty: PenaltyRecord, goal: PenaltyGoal): number {
  return penaltyRemainingMs(penalty, goal.atMs);
}

/**
 * Das Ende einer Zeitstrafe durch ein Gegentor -- EINE Ableitung für Cockpit, Neuladen, andere Geräte, Monitor und
 * Zuschauer (@W2A-013, @W2A-014, @W2A-015, @W2A-018, @SL-030, @SL-044, @SL-092, @SL-094, @SL-095, @SL-200, @SL-203, @SL-205).
 *
 * Aus den wirksamen Strafen und Toren (Zurückgenommenes hat der Aufrufer schon entfernt; deshalb läuft eine Strafe nach
 * der Rücknahme des Tores mit ihrer Restzeit weiter, @SL-044) entsteht je Strafe, ob ein Tor sie beendet hat:
 * - Ein Tor beendet nur Strafen des Teams, das es kassiert hat (ein Eigentor zählt für den Gegner, also gegen den Schützen).
 * - Nur Tore NACH der Sekunde des Strafbeginns zählen (@SL-200), solange die Strafe noch lief.
 * - „Gleiche Unterzahl“ nach BFV (@SL-203, @SL-094, @W2A-018): verglichen wird die Zahl der laufenden Strafen beider Teams
 *   (auch solche mit Regel „aus“ zählen mit). Nur wenn das treffende Team WENIGER laufende Strafen hat als der Gegner,
 *   beendet das Tor beim Gegner eine Strafe; bei gleich vielen oder mehr beendet es nichts.
 * - Bei mehreren Strafen endet nur die mit der kürzesten Restzeit; bei Gleichstand die zuerst eingetragene (@W2A-014, @SL-205).
 * - Eine Strafe mit `endsOnGoal === false` (Regel aus) endet nie durch ein Tor (@W2A-015); ohne Angabe gilt „an“.
 * Tore nach `elapsedMs` bleiben außen vor.
 */
export function resolvePenalties(
  penalties: readonly PenaltyRecord[],
  goals: readonly PenaltyGoal[],
  elapsedMs: number,
): PenaltyStatus[] {
  const endedBy = new Map<string, PenaltyGoal>();
  const inOrder = goals
    .map((goal, index) => ({ goal, index }))
    .filter(({ goal }) => goal.atMs <= elapsedMs)
    .sort((a, b) => a.goal.atMs - b.goal.atMs || a.index - b.index);
  for (const { goal } of inOrder) {
    const running = (penalty: PenaltyRecord): boolean =>
      !endedBy.has(penalty.id) && penalty.startMs <= goal.atMs && remainingAtGoal(penalty, goal) > 0;
    const own = penalties.filter((penalty) => penalty.teamId === goal.scoringTeamId && running(penalty)).length;
    const opponent = penalties.filter((penalty) => penalty.teamId !== goal.scoringTeamId && running(penalty));
    if (own >= opponent.length) {
      continue;
    }
    let first: PenaltyRecord | undefined;
    for (const candidate of opponent) {
      const canEnd =
        candidate.endsOnGoal !== false &&
        Math.floor(goal.atMs / MS_PER_SECOND) > Math.floor(candidate.startMs / MS_PER_SECOND);
      if (canEnd && (first === undefined || remainingAtGoal(candidate, goal) < remainingAtGoal(first, goal))) {
        first = candidate;
      }
    }
    if (first !== undefined) {
      endedBy.set(first.id, goal);
    }
  }
  return penalties.map((penalty) => {
    const endedByGoal = endedBy.get(penalty.id) ?? null;
    return { penalty, endedByGoal, remainingMs: endedByGoal === null ? penaltyRemainingMs(penalty, elapsedMs) : 0 };
  });
}

/** Laufende Strafen: Rest > 0 und nicht durch ein Tor beendet, in Log-Reihenfolge. */
export function runningPenalties(statuses: readonly PenaltyStatus[]): PenaltyStatus[] {
  return statuses.filter((status) => status.remainingMs > 0);
}

/**
 * Teams, die sich nach einem Gegentor ergänzen dürfen (@SL-030, @SL-092, @SL-204): fest `ERGAENZEN_HINWEIS_MS` Spielzeit nach
 * dem Tor; bekommt das Team danach eine neue Strafe, verschwindet der Hinweis sofort. `abMs`: Tore davor (frühere Abschnitte)
 * zeigen nichts mehr. Rein abgeleitet; ein zurückgenommenes Tor nimmt den Hinweis mit.
 */
export function ergaenzenTeams(statuses: readonly PenaltyStatus[], elapsedMs: number, abMs = 0): string[] {
  const teams = new Set<string>();
  for (const { penalty, endedByGoal } of statuses) {
    if (endedByGoal === null || endedByGoal.atMs < abMs || elapsedMs >= endedByGoal.atMs + ERGAENZEN_HINWEIS_MS) {
      continue;
    }
    const neueStrafe = statuses.some(
      (other) => other.penalty.teamId === penalty.teamId && other.penalty.id !== penalty.id && other.penalty.startMs >= endedByGoal.atMs,
    );
    if (!neueStrafe) {
      teams.add(penalty.teamId);
    }
  }
  return [...teams];
}

/** Aus dem Engine-Zustand: wirksame (nicht zurückgenommene) Strafen und Tore -> Stand aller Strafen bei `elapsedMs`. */
export function penaltyStatuses(state: MatchState, elapsedMs: number): PenaltyStatus[] {
  const penalties = state.penalties.filter((penalty) => !state.retracted.includes(penalty.id));
  const goals = state.goals
    .filter((goal) => !state.retracted.includes(goal.id))
    .map((goal) => ({ id: goal.id, scoringTeamId: goal.scoringTeamId, atMs: goal.atMs }));
  return resolvePenalties(penalties, goals, elapsedMs);
}

/** Laufende Strafen bei Spielzeit `elapsedMs`: nicht zurückgenommen, nicht durch ein Gegentor beendet, Rest > 0, in Log-Reihenfolge. */
export function activePenalties(state: MatchState, elapsedMs: number): PenaltyRecord[] {
  return runningPenalties(penaltyStatuses(state, elapsedMs)).map((status) => status.penalty);
}
