/**
 * Länge des kürzesten Abschnitts eines Turniers in Sekunden (Gruppenphase oder Finalrunde, geteilt durch die
 * Zahl der Spielabschnitte). Grundlage für den gültigen Bereich der angehaltenen Schlussphase (@W2A-040:
 * „größer als ein Abschnitt“). Rein, ohne React.
 */
import type { Tournament } from '../../../../types/tournament';

export function sectionSecondsOf(tournament: Pick<Tournament, 'groupPhaseGameDuration' | 'finalRoundGameDuration' | 'gamePeriods'>): number {
  const dauern = [tournament.groupPhaseGameDuration, tournament.finalRoundGameDuration]
    .filter((minuten): minuten is number => typeof minuten === 'number' && minuten > 0);
  const abschnitte = Math.max(1, Math.floor(tournament.gamePeriods ?? 1));
  // Ohne Angabe gilt keine Einschränkung durch die Abschnittslänge (nur der Bereich 1 bis 5).
  const kuerzesteMinuten = dauern.length > 0 ? Math.min(...dauern) : Number.POSITIVE_INFINITY;
  return Math.floor((kuerzesteMinuten * 60) / abschnitte);
}
