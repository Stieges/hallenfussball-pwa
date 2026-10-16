/**
 * K.o.-Entscheidung (B1b, B-U3, R4b/R4c): Übergang in Verlängerung oder Strafstoßschießen nach
 * dem konfigurierten (rules.tiebreak) bzw. per TIEBREAK_CHOICE gewählten Modus.
 */
import type { EngineEvent, MatchState, TiebreakMode } from '../types';

const CHOICE_TO_MODE: Record<'overtime' | 'goldenGoal' | 'shootout', TiebreakMode> = {
  overtime: 'overtime-then-shootout',
  goldenGoal: 'goldenGoal',
  shootout: 'shootout',
};

/** Direkt ins Strafstoßschießen: status + phase `shootout`, Abschnitt bleibt. */
export function enterShootout(state: MatchState): MatchState {
  return { ...state, status: 'shootout', phase: 'shootout' };
}

/**
 * Pause vor der Verlängerung: status `section_break`, phase `overtime`, section = sections+1.
 * C0a (V2): `breakStartedAt` = `at` des auslösenden Ereignisses (MATCH_END bzw. TIEBREAK_CHOICE).
 */
export function enterOvertimeBreak(state: MatchState, at: number): MatchState {
  const sections = state.rules?.sections ?? 1;
  return { ...state, status: 'section_break', phase: 'overtime', section: sections + 1, breakStartedAt: at };
}

/** Nach einem K.o.-Remis am Ende der regulären Zeit je Modus weiter; ohne Modus `decision_pending`. */
export function enterDecision(state: MatchState, mode: TiebreakMode | null, at: number): MatchState {
  if (mode === 'shootout') {
    return enterShootout(state);
  }
  if (mode === 'overtime-then-shootout' || mode === 'goldenGoal') {
    return enterOvertimeBreak(state, at);
  }
  return { ...state, status: 'decision_pending' };
}

/** TIEBREAK_CHOICE (nur aus decision_pending, Tabelle): Modus merken und wie konfiguriert weiter. */
export function applyTiebreakChoice(state: MatchState, event: EngineEvent): MatchState {
  const choice = (event.payload as { choice: keyof typeof CHOICE_TO_MODE }).choice;
  const mode = CHOICE_TO_MODE[choice];
  return enterDecision({ ...state, tiebreakMode: mode }, mode, event.at);
}
