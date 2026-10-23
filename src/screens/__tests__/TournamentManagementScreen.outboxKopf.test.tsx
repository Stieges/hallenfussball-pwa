/**
 * A-08f3e3 (M-1): Der Hinweis auf wartende und nicht übernommene Einträge steht im Kopf der Turnierverwaltung
 * für alle Tabs außer Live (dort zeigt ihn das Cockpit) -- auch im Spielplan. Szenario @FU-004.
 * Inhalt des Hinweises: `EngineOutboxHeaderStatus.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast';

vi.mock('../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({
    tournament: { id: 't1', name: 'Wintercup', teams: [], matches: [], groups: [], numberOfGroups: 1 },
    schedule: { allMatches: [], rounds: [] }, currentStandings: [], isLoading: false, loadingError: null,
    handleTournamentUpdate: vi.fn(), applyRemote: vi.fn(), scheduleService: {},
  }),
}));
// GA4 A-13c: Spielplan und Tabellen liegen unter den Anbietern für „Gruppe abschließen“ (Rechte, Repositories); hier nur die Hülle des Bildschirms
vi.mock('../../features/tournament-management/standings/StandingTieProvider', () => ({ StandingTieProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../features/tournament-management/group-completion/GroupCompletionProvider', () => ({ GroupCompletionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => null }));
vi.mock('../../features/tournament-management/components/EngineOutboxHeaderStatus', () => ({
  EngineOutboxHeaderStatus: ({ tournament }: { tournament: { id: string } }) => <span data-testid="engine-outbox-kopf">{tournament.id}</span>,
}));
vi.mock('../../features/tournament-management/ScheduleTab', () => ({ ScheduleTab: () => <p>Spielplan-Tab</p> }));
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

describe('A-08f3e3 Hinweis im Kopf der Turnierverwaltung', () => {
  it('Spielplan-Tab: Kopf zeigt den Übertragungs-/Ablehnungs-Hinweis für dieses Turnier', () => {
    mount('/tournament/t1/schedule');
    expect(screen.getByText('Spielplan-Tab')).toBeInTheDocument();
    expect(screen.getByTestId('engine-outbox-kopf').textContent).toBe('t1');
  });

  it('Gegenbeispiel: im Live-Tab zeigt das Cockpit den Status selbst, der Kopf nicht doppelt', () => {
    mount('/tournament/t1/live');
    expect(screen.queryByTestId('engine-outbox-kopf')).toBeNull();
  });

  it('auch auf einem anderen Tab (Teams) steht der Hinweis im Kopf', () => {
    mount('/tournament/t1/teams');
    expect(screen.getByText('Teams-Tab')).toBeInTheDocument();
    expect(screen.getByTestId('engine-outbox-kopf')).toBeInTheDocument();
  });
});
