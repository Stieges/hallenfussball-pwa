/**
 * Endstand in der App (R3-5; @ET-041, @ET-042, @ET-044, @ET-045, @TM-058, @HE-070 Z. 2, @HE-098 Z. 2). Zwei Quellen, nie gemischt:
 * - Turnier abgeschlossen (`lifecycleStatus = finished`): NUR der beim Abschluss gespeicherte Endstand
 *   (`tournament_final_standings`), nie eine Neurechnung – auch nicht bei neuer App-Version (@ET-045, Ruling E1). Ist er nicht
 *   lesbar, steht ein Hinweis, kein errechneter Ersatz.
 * - sonst: der Endstand, wie er gerade steht (`computeFinalStandings`, `computeScorers`), gekennzeichnet „vorläufig“ (@ET-042).
 * Turnierleitung und Helfer lesen dieselbe Zeile (`writeMatchData`); Helfer landen nach dem Abschluss über `/standings` hier.
 * Über dem gespeicherten Endstand steht „Als PDF“ (@DR-048 Z. 3): öffnet den PDF-Dialog mit vorgewähltem „Endstand“, nur für
 * Turnierleitung, Co-Admin und Helfer (Recht writeMatchData, nach dem Abschluss offen; Daniel 07.11.).
 */
import type { GeneratedSchedule } from '../../../core/generators';
import type { Standing, Tournament } from '../../../types/tournament';
import { computeFinalStandings } from '../../../core/standings/finalStandings';
import { cssVars } from '../../../design-tokens';
import { FinalStandingsPdfButton } from './FinalStandingsPdfButton';
import { useStoredFinalStandingsReload } from '../hooks/useStoredFinalStandings';
import { useProvisionalScorers } from '../hooks/useProvisionalScorers';
import { FinalStandingsView } from './FinalStandingsView';
import { FinalStandingsStatus } from './FinalStandingsStatus';

export interface FinalStandingsPanelProps {
  tournament: Tournament;
  /** Für „Als PDF“ (@DR-048 Z. 3); ohne Spielplan kein Knopf. */
  schedule?: GeneratedSchedule;
  standings?: Standing[];
}

export function FinalStandingsPanel({ tournament, schedule, standings = [] }: FinalStandingsPanelProps) {
  const finished = tournament.lifecycleStatus === 'finished';
  const { state: stored, reload } = useStoredFinalStandingsReload(tournament.id, finished, tournament.finishedAt);
  const provisionalScorers = useProvisionalScorers(tournament, !finished);

  if (finished) {
    if (stored.status === 'ok') {
      return (
        <div style={{ display: 'grid', gap: cssVars.spacing.md }}>
          {schedule !== undefined && <FinalStandingsPdfButton tournament={tournament} schedule={schedule} standings={standings} />}
          <FinalStandingsView tournament={tournament} ranking={stored.snapshot.ranking} scorers={stored.snapshot.scorers} provisional={false} finishedAt={stored.finishedAt} />
        </div>
      );
    }
    const kind = stored.status === 'loading' ? 'loading' : stored.status === 'none' ? 'missing' : 'unavailable';
    return <FinalStandingsStatus kind={kind} onRetry={reload} />;
  }
  if (!tournament.matches.some((match) => match.matchStatus === 'finished')) {
    return <FinalStandingsStatus kind="empty" />;
  }
  return <FinalStandingsView tournament={tournament} ranking={computeFinalStandings(tournament).ranking} scorers={provisionalScorers.scorers} scorersIncomplete={provisionalScorers.incomplete} provisional />;
}
