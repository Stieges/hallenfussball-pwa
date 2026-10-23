/**
 * @ZP-093: Rückgängig, Wiederholen und vorgemerkte Feldwechsel dürfen Zeit und Feld eines angepfiffenen Spiels
 * (läuft, Halbzeit, beendet) nicht zurücksetzen. Prüfung wie überall über `getMatchStartState`.
 */
import type { Match } from '../../../types/tournament';
import { getMatchStartState } from '../../../utils/matchStartState';

/** Angepfiffen laut Stand der Turnierkopie. */
export function isStartedMatch(match: Match | undefined): boolean {
  return match !== undefined && getMatchStartState([match]) === 'started';
}

/**
 * Übernimmt aus dem Schnappschuss alles, nur nicht Zeit und Feld von Spielen, die jetzt angepfiffen sind:
 * die behalten ihren aktuellen Platz.
 */
export function keepStartedPlaces(snapshot: Match[], current: Match[]): Match[] {
  const now = new Map(current.map((m) => [m.id, m]));
  return snapshot.map((m) => {
    const live = now.get(m.id);
    return live && isStartedMatch(live) ? { ...m, scheduledTime: live.scheduledTime, field: live.field } : m;
  });
}
