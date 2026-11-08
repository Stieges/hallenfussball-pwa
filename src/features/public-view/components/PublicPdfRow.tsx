/**
 * Knopf „Als PDF“ der Zuschauer-Seite im Fluss, rechtsbündig (@BM-028 Zeile „Mama Petra“, @BM-057 Z. 3, @BM-041): vor dem Abschluss
 * „Spielplan“ (nur Paarungen, Uhrzeiten, Felder), nach dem Abschluss dazu der Endstand der Zuschauer-Seite – nur wenn sie ihn zeigen
 * darf (nicht im Kindermodus, nicht bei ausgeblendeten Tabellen; `publicFinalSource`).
 */
import type { CSSProperties } from 'react';
import type { GeneratedSchedule } from '../../../core/generators';
import type { PublicFinalStandings } from '../../../core/repositories/publicFinalStandings';
import type { TournamentView } from '../../../core/view';
import { cssVars } from '../../../design-tokens';
import { PublicPdfButton } from '../../../components/PublicPdfButton';
import { publicFinalSource } from '../../../components/dialogs/pdfExport/finalPdfSource';
import type { Standing, Tournament } from '../../../types/tournament';
import { showsFinalStandings } from '../showsFinalStandings';

export interface PublicPdfRowProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
  view: TournamentView;
  finalStandings: PublicFinalStandings;
}

const row: CSSProperties = { display: 'flex', justifyContent: 'flex-end', margin: `${cssVars.spacing.md} 0` };

export const PublicPdfRow = ({ tournament, schedule, standings, view, finalStandings }: PublicPdfRowProps) => {
  const final = publicFinalSource(
    tournament,
    { results: view.rules.results, tables: view.rules.tables, finalShown: showsFinalStandings(view, finalStandings) },
    finalStandings,
  );
  return (
    <div style={row}>
      <PublicPdfButton tournament={tournament} schedule={schedule} standings={standings} final={final} />
    </div>
  );
};
