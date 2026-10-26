/**
 * Endstand in der App (R3-5; @ET-041, @ET-042, @ET-044, @ET-045, @TM-058, @HE-070 Z. 2, @HE-098 Z. 2). Zwei Quellen, nie gemischt:
 * - Turnier abgeschlossen (`lifecycleStatus = finished`): NUR der beim Abschluss gespeicherte Endstand
 *   (`tournament_final_standings`), nie eine Neurechnung – auch nicht bei neuer App-Version (@ET-045, Ruling E1). Ist er nicht
 *   lesbar, steht ein Hinweis, kein errechneter Ersatz.
 * - sonst: der Endstand, wie er gerade steht (`computeFinalStandings`, `computeScorers`), gekennzeichnet „vorläufig“ (@ET-042).
 * Turnierleitung und Helfer lesen dieselbe Zeile (`writeMatchData`); Helfer landen nach dem Abschluss über `/standings` hier.
 */
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../../types/tournament';
import { computeFinalStandings } from '../../../core/standings/finalStandings';
import { useStoredFinalStandings } from '../hooks/useStoredFinalStandings';
import { useProvisionalScorers } from '../hooks/useProvisionalScorers';
import { FinalStandingsView } from './FinalStandingsView';
import { small } from './finishStyles';

export function FinalStandingsPanel({ tournament }: { tournament: Tournament }) {
  const { t } = useTranslation('tournament');
  const finished = tournament.lifecycleStatus === 'finished';
  const stored = useStoredFinalStandings(tournament.id, finished, tournament.finishedAt);
  const scorers = useProvisionalScorers(tournament, !finished);

  if (finished) {
    if (stored.status === 'ok') {
      return <FinalStandingsView tournament={tournament} ranking={stored.snapshot.ranking} scorers={stored.snapshot.scorers} provisional={false} finishedAt={stored.finishedAt} />;
    }
    const failed = stored.status !== 'loading';
    return <p style={small} role="status" data-testid={failed ? 'final-standings-unavailable' : 'final-standings-loading'}>{t(failed ? 'finalStandings.unavailable' : 'finalStandings.loading')}</p>;
  }
  if (!tournament.matches.some((match) => match.matchStatus === 'finished')) {
    return <p style={small} data-testid="final-standings-empty">{t('finalStandings.empty')}</p>;
  }
  return <FinalStandingsView tournament={tournament} ranking={computeFinalStandings(tournament).ranking} scorers={scorers} provisional />;
}
