/**
 * @LZ-007: Der Vorschlag „Turnier abschließen“ steht oben im Spielplan der Turnierverwaltung, über dem Spielplan selbst und nur dort
 * (nicht auf Teams oder im Live-Reiter). Was der Vorschlag sagt und wann er erscheint: `FinishTournamentSection.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast';

vi.mock('../../hooks/useAutoRecompletion', () => ({ useAutoRecompletion: () => undefined }));
vi.mock('../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({
    tournament: { id: 't1', name: 'Wintercup', teams: [], matches: [{ id: 'm1' }], groups: [], numberOfGroups: 1 },
    schedule: { allMatches: [], rounds: [] }, currentStandings: [], isLoading: false, loadingError: null,
    handleTournamentUpdate: vi.fn(), applyRemote: vi.fn(), scheduleService: {},
  }),
}));
vi.mock('../../features/tournament-management/standings/StandingTieProvider', () => ({ StandingTieProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../features/tournament-management/group-completion/GroupCompletionProvider', () => ({ GroupCompletionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => null }));
vi.mock('../../features/klaerungsliste/KlaerungslisteEinstieg', () => ({ KlaerungslisteEinstieg: () => null }));
vi.mock('../../features/tournament-management/components/EngineOutboxHeaderStatus', () => ({ EngineOutboxHeaderStatus: () => null }));
vi.mock('../../features/tournament-finish/components/FinishTournamentSection', () => ({
  FinishTournamentSection: ({ placement }: { placement?: string }) => <div data-testid="abschluss-vorschlag" data-placement={placement} />,
}));
vi.mock('../../features/tournament-management/ScheduleTab', () => ({ ScheduleTab: () => <p data-testid="spielplan-tab">Spielplan-Tab</p> }));
vi.mock('../../features/tournament-management/TeamsTab', () => ({ TeamsTab: () => <p>Teams-Tab</p> }));
vi.mock('../../features/tournament-management/ManagementTab', () => ({ ManagementTab: () => <p>Live-Tab</p> }));

import { TournamentManagementScreen } from '../TournamentManagementScreen';

function mount(path: string) {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <TournamentManagementScreen tournamentId="t1" onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('@LZ-007 Vorschlag zum Abschließen oben im Spielplan', () => {
  it('im Spielplan steht der Vorschlagsbereich (für den Spielplan) vor dem Spielplan selbst', () => {
    mount('/tournament/t1/schedule');
    const vorschlag = screen.getByTestId('abschluss-vorschlag');
    expect(vorschlag).toHaveAttribute('data-placement', 'schedule');
    expect(vorschlag.compareDocumentPosition(screen.getByTestId('spielplan-tab')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Gegenbeispiel: im Teams-Reiter gibt es ihn nicht', () => {
    mount('/tournament/t1/teams');
    expect(screen.queryByTestId('abschluss-vorschlag')).toBeNull();
  });
});
