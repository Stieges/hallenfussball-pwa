/**
 * „Läuft“ auf einem Helfer-Gerät (A-17c-2; @HE-096, @HE-099, @HE-109): Ein Turnier läuft, wenn es heute stattfindet (Datum des
 * Geräts gegen den Turniertag) oder angepfiffen ist, und nicht abgeschlossen ist. Gilt für Helfer-Zugänge (Zugangs-Index) und
 * für eigene Turniere auf dem Gerät. Reine Funktionen ohne React und ohne Netz.
 *
 * - Helfer-Zugang: zugelassen, nicht abgeschlossen und Turniertag heute oder vorbei, aber höchstens bis einschließlich zum Tag
 *   danach (läuft noch; der Zugang endet erst mit dem Turnier, @HE-098 Zeile 3; ein nie abgeschlossenes Turnier zieht den Start
 *   nicht dauerhaft an sich, @HE-111). Ein Turniertag in der Zukunft läuft nicht (→ Einsatz-Karte, @HE-109).
 * - Eigenes Turnier: veröffentlicht, nicht im Papierkorb, nicht abgeschlossen oder abgebrochen und (Turniertag heute oder ein
 *   Spiel angepfiffen, Letzteres ebenfalls nur bis einschließlich zum Tag nach dem Turniertag, @HE-111).
 * Es zählt das eine Turnierdatum (Index-Eintrag `date`, bei eigenen Turnieren `startDate`, sonst `date`); Datenmodell und Server
 * kennen kein Enddatum, der eine Nachlauftag deckt auch einen zweiten Turniertag. Ein unlesbares oder leeres Datum gilt
 * nie als laufend (sichere Richtung zu @HE-111).
 */
/** Tage Nachlauf nach dem letzten Turniertag, in denen ein nie abgeschlossenes Turnier noch als laufend gilt (@HE-111). */
export const RUNNING_GRACE_DAYS = 1;

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

/** `YYYY-MM-DD` plus Tage (Ortszeit, ohne Zeitzonen-Sprung). */
function addDaysKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}

/** Zugelassen und nicht abgeschlossen: Toms Einsatz (läuft jetzt oder kommt noch). */
export function isOpenAssignment(entry: HelperAccessEntry): boolean {
  return entry.relation === 'accepted' && !entry.closed;
}

/** Läuft der Helfer-Zugang? Ein unlesbares Datum zählt nicht als laufend (das Feld bleibt über die Einsatz-Karte erreichbar). */
export function isRunningHelperEntry(entry: HelperAccessEntry, now: Date): boolean {
  if (!isOpenAssignment(entry)) {
    return false;
  }
  const day = toDateKey(entry.date);
  return day !== null && day <= localDateKey(now) && localDateKey(now) <= addDaysKey(day, RUNNING_GRACE_DAYS);
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
  const today = localDateKey(now);
  return day !== null && (day === today || (wasKickedOff(tournament) && today <= addDaysKey(day, RUNNING_GRACE_DAYS)));
}
