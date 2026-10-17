/**
 * A-25a (@FU-094, Ruling R-A25a-1): Regel „ein K.-o.-Unentschieden braucht beim Direkteintrag ein
 * Strafstoßergebnis, ein Gruppenspiel darf keins haben“. Die Rechenfunktion prüft nur die Form
 * (payloadValidation.ts); ob ein Spiel K.-o. ist, weiß sie bei einem Direkteintrag ohne Anpfiff nicht.
 * Deshalb prüfen zwei Stellen aus derselben Quelle (`knockout` aus `serverRules`/`server_rules`, also
 * `matches.phase`): der Server in `append_match_events` (SQL-Zwilling, Migration 20261028_003) und
 * das Gerät vor dem Senden. Ablehnung als INVALID_PAYLOAD mit diesem Grund.
 */
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
