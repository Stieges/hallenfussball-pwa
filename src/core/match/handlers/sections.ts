/**
 * Abschnitte (B1b, B-U2/B-U4). `section` = 1..rules.sections regulär, Verlängerung = sections+1.
 * Die Spieluhr ist kumulativ (B-U1): ein Abschnitt beginnt mit dem Stand, mit dem der vorige endete.
 */
import { ERROR_CODES, type EngineEvent, type ErrorCode, type MatchState } from '../types';
import { resumeClock, stopClock } from './clock';

export type SectionOutcome =
  | { status: 'ok'; state: MatchState }
  | { status: 'rejected'; code: ErrorCode; detail: { reason: 'LAST_SECTION' | 'OVERTIME' } };

/**
 * SECTION_END: nur in phase regular und nicht im letzten Abschnitt (sonst INVALID_TRANSITION mit
 * `{reason:'LAST_SECTION'}`); in der Verlängerung immer INVALID_TRANSITION `{reason:'OVERTIME'}`
 * (ein Abschnitt, B-U14). Wirkung: Uhr stoppen wie PAUSE; den Status `section_break` setzt die Tabellenzeile.
 */
export function applySectionEnd(state: MatchState, event: EngineEvent): SectionOutcome {
  if (state.phase !== 'regular') {
    return { status: 'rejected', code: ERROR_CODES.INVALID_TRANSITION, detail: { reason: 'OVERTIME' } };
  }
  const sections = state.rules?.sections ?? 1;
  if (state.section >= sections) {
    return { status: 'rejected', code: ERROR_CODES.INVALID_TRANSITION, detail: { reason: 'LAST_SECTION' } };
  }
  return { status: 'ok', state: { ...state, clock: stopClock(state.clock, event) } };
}

/**
 * SECTION_START: Uhr läuft (`anchorAt = at`, `elapsedMs = clockMs ?? elapsedMs`). Regulär geht es
 * in den nächsten Abschnitt; vor der Verlängerung steht `section` schon auf sections+1.
 */
export function applySectionStart(state: MatchState, event: EngineEvent): MatchState {
  const section = state.phase === 'regular' ? state.section + 1 : state.section;
  return { ...state, section, clock: resumeClock(state.clock, event) };
}
