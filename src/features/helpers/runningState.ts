/**
 * „Läuft“ auf einem Helfer-Gerät (A-17c-2; @HE-096, @HE-099, @HE-109): Ein Turnier läuft, wenn es heute stattfindet (Datum des
 * Geräts gegen den Turniertag) oder angepfiffen ist, und nicht abgeschlossen ist. Gilt für Helfer-Zugänge (Zugangs-Index) und
 * für eigene Turniere auf dem Gerät. Reine Funktionen ohne React und ohne Netz.
 *
 * - Helfer-Zugang: zugelassen, nicht abgeschlossen und Turniertag heute oder schon vorbei (läuft noch; der Zugang endet erst mit
 *   dem Turnier, @HE-098 Zeile 3). Ein Turniertag in der Zukunft läuft nicht (→ Einsatz-Karte, @HE-109).
 * - Eigenes Turnier: veröffentlicht, nicht im Papierkorb, nicht abgeschlossen oder abgebrochen und (Turniertag heute oder ein
 *   Spiel angepfiffen).
 */
import type { HelperAccessEntry } from '../../core/repositories/helperAccessRpc';
import type { Tournament } from '../../types/tournament';
import { isTournamentCompleted } from '../../utils/tournamentCategories';

/** `YYYY-MM-DD` in Ortszeit des Geräts. */
export function localDateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Turniertag als `YYYY-MM-DD`; `DD.MM.YYYY` (alte Daten) wird umgestellt, Unlesbares ergibt `null`. */
export function toDateKey(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (iso) {
    return iso[1];
  }
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(value);
  return german ? `${german[3]}-${german[2].padStart(2, '0')}-${german[1].padStart(2, '0')}` : null;
}

/** Zugelassen und nicht abgeschlossen: Toms Einsatz (läuft jetzt oder kommt noch). */
export function isOpenAssignment(entry: HelperAccessEntry): boolean {
  return entry.relation === 'accepted' && !entry.closed;
}

/** Läuft der Helfer-Zugang? Unlesbares Datum zählt als laufend (lieber das Feld öffnen als es zu verlieren). */
export function isRunningHelperEntry(entry: HelperAccessEntry, now: Date): boolean {
  if (!isOpenAssignment(entry)) {
    return false;
  }
  const day = toDateKey(entry.date);
  return day === null || day <= localDateKey(now);
}

function wasKickedOff(tournament: Tournament): boolean {
  return tournament.matches.some((match) => match.matchStatus === 'running' || match.matchStatus === 'finished');
}

/** Läuft das eigene Turnier auf dem Gerät? */
export function isRunningOwnTournament(tournament: Tournament, now: Date): boolean {
  if (tournament.status !== 'published' || tournament.deletedAt || tournament.cancelledAt || isTournamentCompleted(tournament)) {
    return false;
  }
  const day = toDateKey(tournament.startDate ?? tournament.date);
  return day === localDateKey(now) || wasKickedOff(tournament);
}
