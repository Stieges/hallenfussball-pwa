/**
 * A-25a (@FU-094, Ruling R-A25a-1): Regel „ein K.-o.-Unentschieden braucht beim Direkteintrag ein
 * Strafstoßergebnis, ein Gruppenspiel darf keins haben“. Die Rechenfunktion prüft nur die Form
 * (payloadValidation.ts); ob ein Spiel K.-o. ist, weiß sie bei einem Direkteintrag ohne Anpfiff nicht.
 * Deshalb prüfen zwei Stellen aus derselben Quelle (`knockout` aus `serverRules`/`server_rules`, also
 * `matches.phase`): der Server in `append_match_events` (SQL-Zwilling, Migration 20261028_003) und
 * das Gerät vor dem Senden. Ablehnung als INVALID_PAYLOAD mit diesem Grund.
 */
import { ERROR_CODES } from './types';
import type { CommandSpec } from './client/matchCommandTypes';

export type ShootoutRuleViolation = 'SHOOTOUT_REQUIRED' | 'SHOOTOUT_NOT_ALLOWED';

export interface ResultEntryScores {
  scores: Record<string, number>;
  shootout?: Record<string, number>;
}

export function shootoutRuleViolation(knockout: boolean, payload: ResultEntryScores): ShootoutRuleViolation | null {
  const hasShootout = payload.shootout !== undefined;
  if (!knockout) {
    return hasShootout ? 'SHOOTOUT_NOT_ALLOWED' : null;
  }
  const [first, second] = Object.values(payload.scores);
  return first === second && !hasShootout ? 'SHOOTOUT_REQUIRED' : null;
}

/** A-25a Schritt 3b: Befehl für `MatchCommands.enterResult` -- Regel lokal wie am Server, sonst der Eintrag. */
export type ResultEntryCommand =
  | { ok: true; spec: CommandSpec }
  | { ok: false; code: typeof ERROR_CODES.INVALID_PAYLOAD; detail: { reason: ShootoutRuleViolation } };

export function resultEntryCommand(knockout: boolean, scores: Record<string, number>, shootout?: Record<string, number>): ResultEntryCommand {
  const reason = shootoutRuleViolation(knockout, { scores, shootout });
  if (reason !== null) {
    return { ok: false, code: ERROR_CODES.INVALID_PAYLOAD, detail: { reason } };
  }
  const payload = shootout === undefined ? { scores: { ...scores } } : { scores: { ...scores }, shootout: { ...shootout } };
  return { ok: true, spec: { type: 'RESULT_ENTRY', teamId: null, payload } };
}
