/**
 * B-06 – Abgrenzung im Record „Monitor einrichten“ (Daniel 10.10.): Die alte Groß-Anzeige der Turnierverwaltung
 * (Reiter „Monitor“, MonitorTab) entfällt; einziger Weg für Hallenbildschirme ist der Monitor-Konfigurator,
 * dessen Reiter jetzt „Monitor“ heißt (vorher „Monitore“). Eine alte Adresse (/monitor, /monitors) landet im Konfigurator.
 * Eine Kennung für diese Abgrenzung gibt es im Record nicht (Abgrenzung, kein Szenario).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TournamentManagementScreen } from '../TournamentManagementScreen';
import { ToastProvider } from '../../components/ui/Toast';
import { getTabFromPath } from '../../features/tournament-management/utils/tournamentTabUtils';

vi.mock('../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({
    tournament: { id: 't1', name: 'Wintercup', teams: [], matches: [], groups: [], numberOfGroups: 1 },
    schedule: { allMatches: [], rounds: [] }, currentStandings: [], isLoading: false, loadingError: null,
    handleTournamentUpdate: vi.fn(), applyRemote: vi.fn(), scheduleService: {},
  }),
}));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => null }));
vi.mock('../../features/tournament-management/MonitorsConfigTab', () => ({
  MonitorsConfigTab: () => <p data-testid="monitor-konfigurator">Konfigurator</p>,
}));

function mount(pfad: string) {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[pfad]}>
        <TournamentManagementScreen
          tournamentId="t1" onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()}
        />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('B-06 Reiter „Monitor“ in der Turnierverwaltung', () => {
  it('Pflichttest: genau ein Reiter „Monitor“, kein Reiter „Monitore“', () => {
    mount('/tournament/t1/monitor');
    expect(screen.getAllByRole('button', { name: 'Monitor' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Monitore' })).toBeNull();
  });

  it.each(['monitor', 'monitors'])('Pflichttest: die Adresse …/%s zeigt den Konfigurator', (segment) => {
    mount(`/tournament/t1/${segment}`);
    expect(screen.getByTestId('monitor-konfigurator')).toBeInTheDocument();
  });

  it('Gegenbeispiel: eine unbekannte Adresse fällt auf den Spielplan, nicht auf den Konfigurator', () => {
    expect(getTabFromPath('monitor-alt')).toBe('schedule');
    expect(getTabFromPath('monitor')).toBe('monitor');
  });
});
