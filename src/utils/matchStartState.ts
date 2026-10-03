/**
 * getMatchStartState — gemeinsame Funktion „Ist das Turnier angepfiffen?"
 * mit drei Ergebnissen:
 *   'started'     = angepfiffen (mindestens ein Spiel lief/läuft/ist beendet)
 *   'not-started' = nicht angepfiffen (alle Spiele geplant)
 *   'unknown'     = nicht feststellbar (Match-Liste fehlt/ungültig, unbekannter
 *                   Status-String oder ein echtes Lade-/Offline-Signal)
 *
 * Gemeinsamer Auswertungskern für DangerZone („Turnier löschen"), SettingsTab
 * („Im Wizard bearbeiten") und TournamentCard (Papierkorb) — eine Funktion
 * statt drei Kopien (@LZ-003).
 *
 * K1 (Ruling): Ein FEHLENDER matchStatus gilt als 'scheduled' (geplant) — so
 * erzeugt TournamentCreationService.publish() die Spiele. Nur die oben genannten
 * Fälle gelten als „nicht feststellbar" (fail-closed).
 */
import type { Match } from '../types/tournament';

export type MatchStartState = 'not-started' | 'started' | 'unknown';

export function getMatchStartState(matches: Match[] | undefined): MatchStartState {
  if (!Array.isArray(matches)) {
    return 'unknown';
  }
  for (const match of matches) {
    const status: string = match.matchStatus ?? 'scheduled';
    if (status === 'running' || status === 'paused' || status === 'finished') {
      return 'started';
    }
    if (status !== 'scheduled' && status !== 'waiting' && status !== 'skipped') {
      return 'unknown';
    }
  }
  return 'not-started';
}
