/**
 * Zustand C „abgeschlossen“ in der Verwaltung, mit Lesen (Plan R3-4): holt den gespeicherten Endstand und – nur für die
 * Turnierleitung – die Liste „Nach dem Ende eingetroffen“ und übergibt sie der Darstellung (`FinishedStateView`). Hängt NICHT
 * an `useCan('manageLifecycle')` (nach dem Abschluss falsch, Review #394 H-1): der Aufrufer prüft die Rolle mit `openAfterClose`.
 */
import { useAuth } from '../../auth/hooks/useAuth';
import { useLateEntries } from '../hooks/useLateEntries';
import { useStoredFinalStandings } from '../hooks/useStoredFinalStandings';
import { FinishedStateView, type FinishedStateTournament } from './FinishedStateView';

export type { FinishedStateTournament };

export function FinishedStateSection({ tournament, showLate }: { tournament: FinishedStateTournament; showLate: boolean }) {
  const stored = useStoredFinalStandings(tournament.id, true, tournament.finishedAt);
  const late = useLateEntries(tournament.id, showLate);
  const { user } = useAuth();
  const self = user === null || user === undefined ? undefined : { id: user.id, name: user.name.trim() === '' ? null : user.name };
  return <FinishedStateView tournament={tournament} stored={stored} late={showLate ? late : null} self={self} />;
}
