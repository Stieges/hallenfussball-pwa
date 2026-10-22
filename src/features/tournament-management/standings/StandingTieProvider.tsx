/**
 * Anbieter für `StandingTieContext` (Paket TB-B, TB-6b/c): Rechte (`manageLifecycle`, Turnierleitung und Co-Admin), Netz,
 * Dienst und Neuladen aus der Turnierverwaltung. Server prüft `tournamentSettings` (R-TB-8).
 */
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories } from '../../../core/contexts/RepositoryContext';
import { StandingDecisionService } from '../../../core/services/StandingDecisionService';
import { groupClosedByFollowUp } from '../../../core/standings/groupClosure';
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
    () => new StandingDecisionService(tournamentRepository, { groupClosed: (tournament, groupId) => groupClosedByFollowUp(tournament, groupId) }),
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
