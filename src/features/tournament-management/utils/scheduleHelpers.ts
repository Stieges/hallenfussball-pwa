/**
 * Schedule Helper Functions
 *
 * Utility functions for schedule-related operations:
 * - Match status detection (aus dem Turnier-Spiel, A-08f2 / @FU-087)
 * - Team name resolution
 */

import { Tournament, Match } from '../../../types/tournament';

/**
 * Beendet = Ergebnis vorhanden (wie bisher; kein Ergebnis = nicht beendet).
 */
export function isMatchFinished(match: Match): boolean {
  return match.scoreA !== undefined && match.scoreB !== undefined;
}

/**
 * Laufend laut Turnierstatus (`matchStatus`, aus der Engine-Projektion). Kein localStorage-Zugriff:
 * ein veralteter Alteintrag darf kein Spiel als laufend markieren (@FU-087).
 */
export function isMatchRunning(match: Match): boolean {
  return match.matchStatus === 'running';
}

/**
 * Get all finished match IDs for a tournament
 *
 * @param tournament - The tournament
 * @returns Set of finished match IDs
 */
export function getFinishedMatchIds(tournament: Tournament): Set<string> {
  return new Set(
    tournament.matches
      .filter(m => isMatchFinished(m))
      .map(m => m.id)
  );
}
