/**
 * @W5-042: Hat das geladene Turnier keine Spiele, erzeugt die Verwaltung keinen Plan; sie zeigt „Spielplan noch nicht erstellt“
 * mit einer Taste in den Wizard. Mit Spielen erscheint der Hinweis nicht.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ToastProvider } from '../../../components/ui/Toast';

const state = vi.hoisted(() => ({ matches: [] as unknown[] }));

vi.mock('../../../hooks/useAutoRecompletion', () => ({ useAutoRecompletion: () => undefined }));
vi.mock('../../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({
    tournament: { id: 't1', name: 'Wintercup', teams: [], matches: state.matches, groups: [], numberOfGroups: 1 },
    schedule: { allMatches: [], rounds: [] }, currentStandings: [], isLoading: false, loadingError: null,
    handleTournamentUpdate: vi.fn(), applyRemote: vi.fn(), scheduleService: {},
  }),
}));
vi.mock('../standings/StandingTieProvider', () => ({ StandingTieProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../group-completion/GroupCompletionProvider', () => ({ GroupCompletionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../../components/layout/AuthSection', () => ({ AuthSection: () => null }));
vi.mock('../../klaerungsliste/KlaerungslisteEinstieg', () => ({ KlaerungslisteEinstieg: () => null }));
vi.mock('../components/EngineOutboxHeaderStatus', () => ({ EngineOutboxHeaderStatus: () => null }));
vi.mock('../../tournament-finish/components/FinishTournamentSection', () => ({ FinishTournamentSection: () => null }));
vi.mock('../ScheduleTab', () => ({ ScheduleTab: () => <p data-testid="spielplan-tab">Spielplan-Tab</p> }));
vi.mock('../ManagementTab', () => ({ ManagementTab: () => <p data-testid="live-tab">Live-Tab</p> }));
vi.mock('../TeamsTab', () => ({ TeamsTab: () => <p data-testid="teams-tab">Teams-Tab</p> }));

import { TournamentManagementScreen } from '../../../screens/TournamentManagementScreen';

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

function mount(path: string) {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <TournamentManagementScreen tournamentId="t1" onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()} />
        <Where />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('@W5-042 Verwaltung eines Turniers ohne Spiele', () => {
  it('Spielplan und Live-Reiter zeigen den Hinweis statt eines erzeugten Plans; die Taste führt in den Wizard', () => {
    state.matches = [];
    mount('/tournament/t1/schedule');
    expect(screen.getByTestId('schedule-missing-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('spielplan-tab')).toBeNull();
    fireEvent.click(screen.getByTestId('schedule-missing-open-wizard'));
    expect(screen.getByTestId('where')).toHaveTextContent('/tournament/t1/edit');
  });

  it('Live-Reiter ohne Spiele: ebenfalls der Hinweis', () => {
    state.matches = [];
    mount('/tournament/t1/live');
    expect(screen.getByTestId('schedule-missing-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('live-tab')).toBeNull();
  });

  it('Gegenbeispiel: mit Spielen kein Hinweis, der Spielplan steht da', () => {
    state.matches = [{ id: 'm1' }];
    mount('/tournament/t1/schedule');
    expect(screen.queryByTestId('schedule-missing-notice')).toBeNull();
    expect(screen.getByTestId('spielplan-tab')).toBeInTheDocument();
  });

  it('Gegenbeispiel: der Teams-Reiter bleibt auch ohne Spiele erreichbar', () => {
    state.matches = [];
    mount('/tournament/t1/teams');
    expect(screen.queryByTestId('schedule-missing-notice')).toBeNull();
    expect(screen.getByTestId('teams-tab')).toBeInTheDocument();
  });
});
