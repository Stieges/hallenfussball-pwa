/**
 * Anbieter für `StandingTieContext` (Paket TB-B, TB-6b/c): Rechte (`manageLifecycle`, Turnierleitung und Co-Admin), Netz,
 * Dienst und Neuladen aus der Turnierverwaltung. Der Server prüft `manageLifecycle` (`record_standing_decision`, R-GA4v2-1).
 */
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories } from '../../../core/contexts/RepositoryContext';
import { StandingDecisionService } from '../../../core/services/StandingDecisionService';
import { groupClosedFromCompletions } from '../../../core/standings/groupCompletions';
import { useIsOnline } from '../../../hooks/useOnlineStatus';
import { useCan } from '../../auth/hooks/useCan';
import { buildTournamentTabPath } from '../utils/tournamentTabUtils';
import { StandingTieContext, type StandingTieContextValue } from './standingTieContext';

export const StandingTieProvider = ({ tournamentId, onChanged, children }: { tournamentId: string; onChanged: () => void; children: ReactNode }) => {
  const { tournamentRepository } = useRepositories();
  const canDecide = useCan('manageLifecycle', tournamentId);
  const online = useIsOnline();
  const navigate = useNavigate();
  const service = useMemo(
    // GA4 A-13b-C: der echte Zustand „Gruppe abgeschlossen“ (Abschluss vorhanden, nicht wieder geöffnet) – nicht mehr die Zwischenregel
    // über Folgespiele (Nikolaus hat keine, @W2A-070).
    () => new StandingDecisionService(tournamentRepository, { groupClosed: groupClosedFromCompletions }),
    [tournamentRepository],
  );
  const value = useMemo<StandingTieContextValue>(() => ({
    tournamentId,
    canDecide,
    online,
    service,
    onChanged,
    openRules: () => { void navigate(`${buildTournamentTabPath(tournamentId, 'settings')}?abschnitt=gleichstand`); },
  }), [tournamentId, canDecide, online, service, onChanged, navigate]);
  return <StandingTieContext.Provider value={value}>{children}</StandingTieContext.Provider>;
};
