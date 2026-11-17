/**
 * Quelle eines importierten Turniers (@W1-044): EINE Stelle für die zwei Angaben des Imports und für die Frage,
 * ob die Turnierkarte die Marke „Import“ zeigt. Gespeichert wird weiter nur der Text (`externalSource`), damit sich
 * am Format und an bestehenden Turnieren nichts ändert.
 */
import type { Tournament } from '../types/tournament';

/** Datei mit Spielplan: Spiele wurden übernommen. */
export const IMPORT_SOURCE_COMPLETE = 'Import (komplett)';
/** Datei ohne Spielplan: nur Teams; den Spielplan erzeugt der Assistent danach selbst. */
export const IMPORT_SOURCE_TEAMS_ONLY = 'Import (nur Teams)';

/**
 * Die Turnierkarte trägt die Marke nur, wenn der Spielplan aus der Datei kommt. Ein Turnier, das nur mit
 * den Teams der Datei begann, trägt sie nicht (auch nicht, wenn es vor dieser Regel angelegt wurde).
 */
export function importMarkText(tournament: Pick<Tournament, 'isExternal' | 'externalSource'>): string {
  if (!tournament.isExternal || !tournament.externalSource) {return '';}
  return tournament.externalSource === IMPORT_SOURCE_TEAMS_ONLY ? '' : tournament.externalSource;
}
