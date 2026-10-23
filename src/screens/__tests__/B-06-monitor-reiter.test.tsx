/**
 * B-06 – Abgrenzung im Record „Monitor einrichten“ (Daniel 10.10.): Die alte Groß-Anzeige der Turnierverwaltung
 * (Reiter „Monitor“, MonitorTab) entfällt; einziger Weg für Hallenbildschirme ist der Monitor-Konfigurator,
 * dessen Reiter jetzt „Monitor“ heißt (vorher „Monitore“). Eine alte Adresse (/monitor, /monitors) landet im Konfigurator.
 * Kennung @ME-068 (Szenariogrundriss im Record, drei Beispielzeilen: Laptop-Reiter, Handy-„Mehr“, Adresse „/monitors“).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TournamentManagementScreen } from '../TournamentManagementScreen';
import { ToastProvider } from '../../components/ui/Toast';
import { getTabFromPath } from '../../features/tournament-management/utils/tournamentTabUtils';

const geraet = vi.hoisted(() => ({ mobil: false }));

vi.mock('../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({
    tournament: { id: 't1', name: 'Wintercup', teams: [], matches: [], groups: [], numberOfGroups: 1 },
    schedule: { allMatches: [], rounds: [] }, currentStandings: [], isLoading: false, loadingError: null,
    handleTournamentUpdate: vi.fn(), applyRemote: vi.fn(), scheduleService: {},
  }),
}));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => geraet.mobil }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => null }));
vi.mock('../../features/klaerungsliste/KlaerungslisteEinstieg', () => ({ KlaerungslisteEinstieg: () => null })); // B-50: braucht AuthProvider, hier nicht Gegenstand
vi.mock('../../features/tournament-management/ScheduleTab', () => ({
  ScheduleTab: () => <p>Spielplan</p>,
}));
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

afterEach(() => {
  geraet.mobil = false;
});

describe('B-06 @ME-068 Reiter „Monitor“ in der Turnierverwaltung', () => {
  it('Pflichttest @ME-068 (Laptop): genau ein Reiter „Monitor“, kein Reiter „Monitore“; der Reiter öffnet den Konfigurator', () => {
    mount('/tournament/t1/schedule');
    expect(screen.getAllByRole('button', { name: 'Monitor' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Monitore' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Monitor' }));
    expect(screen.getByTestId('monitor-konfigurator')).toBeInTheDocument();
  });

  it('Pflichttest @ME-068 (Handy): im Menü „Mehr“ den Eintrag „Monitor“ wählen öffnet den Konfigurator', () => {
    geraet.mobil = true;
    mount('/tournament/t1/schedule');
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    fireEvent.click(screen.getByRole('button', { name: /^Monitor/ }));
    expect(screen.getByTestId('monitor-konfigurator')).toBeInTheDocument();
  });

  it('Pflichttest @ME-068 (Adresse „/monitors“): die alte Adresse zeigt den Konfigurator', () => {
    mount('/tournament/t1/monitors');
    expect(screen.getByTestId('monitor-konfigurator')).toBeInTheDocument();
  });

  it('Pflichttest @ME-068: die Adresse …/monitor zeigt den Konfigurator', () => {
    mount('/tournament/t1/monitor');
    expect(screen.getByTestId('monitor-konfigurator')).toBeInTheDocument();
  });

  it('Gegenbeispiel @ME-068: eine unbekannte Adresse fällt auf den Spielplan, nicht auf den Konfigurator', () => {
    expect(getTabFromPath('monitor-alt')).toBe('schedule');
    expect(getTabFromPath('monitor')).toBe('monitor');
  });
});
