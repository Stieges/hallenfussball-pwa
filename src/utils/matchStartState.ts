/**
 * getMatchStartState — gemeinsame Funktion „Ist das Turnier angepfiffen?"
 * mit drei Ergebnissen:
 *   'started'     = angepfiffen (mindestens ein Spiel lief/läuft/ist beendet)
 *   'not-started' = nicht angepfiffen (alle Spiele geplant)
 *   'unknown'     = nicht feststellbar (Match-Liste fehlt/ungültig, unbekannter
 *                   Status-String, Live-Stand nicht lesbar/noch nicht geladen)
 *
 * Gemeinsamer Auswertungskern für DangerZone („Turnier löschen"), SettingsTab
 * („Im Wizard bearbeiten") und TournamentCard (Papierkorb) — eine Funktion
 * statt drei Kopien (@LZ-003).
 *
 * K1 (Ruling): Ein FEHLENDER matchStatus gilt als 'scheduled' (geplant) — so
 * erzeugt TournamentCreationService.publish() die Spiele. Nur die oben genannten
 * Fälle gelten als „nicht feststellbar" (fail-closed).
 *
 * W1 (Ruling): Ein Spiel gilt als angepfiffen, wenn `tournament.matches` es als
 * laufend/pausiert/beendet führt ODER der Live-Stand (Live-Repo, wie im Cockpit)
 * es führt. Kann der Live-Stand nicht gelesen werden (Fehler/noch nicht geladen),
 * ist der Zustand nicht feststellbar. Ein liveloses Signal (`undefined`) gibt es
 * nur ohne Live-Repo im Kontext — also ohne Cloud-Synchronisierung (rein lokal);
 * dort genügt die lokale Match-Liste allein.
 */
import type { Match } from '../types/tournament';

export type MatchStartState = 'not-started' | 'started' | 'unknown';

export type LiveStartSignal =
  | { status: 'ok'; anyStarted: boolean }
  | { status: 'error' }
  | { status: 'loading' }
  | undefined;

function evaluateMatches(matches: Match[] | undefined, isEstablished: boolean): MatchStartState {
  if (!Array.isArray(matches)) {
    return 'unknown';
  }
  if (matches.length === 0) {
    // U0 (F1): Ein festgelegtes Turnier hat immer Spiele (publish() erzeugt sie).
    // Eine leere Liste heißt dann: Daten nicht geladen / die Liste liefert die
    // Spiele nicht mit (Cloud-Listen-Ansicht) — nicht feststellbar, fail-closed.
    // Ohne Festgelegt-Marker (Entwurf ohne Spielplan) gilt weiter „nicht angepfiffen".
    return isEstablished ? 'unknown' : 'not-started';
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

export function getMatchStartState(
  matches: Match[] | undefined,
  live?: LiveStartSignal,
  isEstablished = false
): MatchStartState {
  const fromMatches = evaluateMatches(matches, isEstablished);
  if (fromMatches === 'started') {
    return 'started';
  }
  if (live === undefined) {
    // Kein Live-Repo im Kontext (rein lokal, keine Cloud-Synchronisierung):
    // die lokale Match-Liste allein ist ausreichend (Ruling W1).
    return fromMatches;
  }
  if (live.status === 'ok' && live.anyStarted) {
    return 'started';
  }
  if (live.status !== 'ok') {
    // 'loading' (Daten nicht geladen) oder 'error' (Laden fehlgeschlagen/Offline).
    return 'unknown';
  }
  return fromMatches;
}
