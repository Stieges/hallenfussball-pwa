/**
 * R3-3 Verwaltungsbildschirm (`TournamentManagementScreen`) nach dem Abschluss: Hinweis-Kasten und Monitor-Editor.
 * Szenarien: @LZ-036, @LZ-037 Z. 4. Bildschirm-Hülle wie TournamentManagementScreen.altersklasse.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CockpitFrameProvider } from '../../components/live-cockpit/frame/CockpitFrameContext';
import { useAnnounceCockpitFrame } from '../../components/live-cockpit/frame/cockpitFrame';
import { TournamentManagementScreen } from '../TournamentManagementScreen';
import { setTournamentClosed, resetClosedTournaments } from '../../core/services/closedTournaments';

const mobil = vi.hoisted(() => ({ wert: false }));
const verwaltung = vi.hoisted(() => ({
  tournament: { id: 't-1', title: 'Hallencup Süd', ageClass: '', date: '2026-11-28', numberOfFields: 1, teams: [], matches: [] },
  schedule: { allMatches: [], phases: [], teams: [] },
}));
// GA4 A-13c: Spielplan und Tabellen liegen unter den Anbietern für „Gruppe abschließen“ (Rechte, Repositories); hier nur die Hülle des Bildschirms
// A-15b: der Auslöser „erneut abschließen“ braucht Rechte (AuthProvider) und ist hier nicht Gegenstand
vi.mock('../../hooks/useAutoRecompletion', () => ({ useAutoRecompletion: () => undefined }));
vi.mock('../../features/tournament-management/standings/StandingTieProvider', () => ({ StandingTieProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../features/tournament-management/group-completion/GroupCompletionProvider', () => ({ GroupCompletionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => mobil.wert }));
vi.mock('../../hooks/useTournamentManager', () => ({
  useTournamentManager: () => ({
    tournament: verwaltung.tournament,
    schedule: verwaltung.schedule,
    currentStandings: [], isLoading: false, loadingError: null,
    handleTournamentUpdate: vi.fn(), applyRemote: vi.fn(), scheduleService: {},
  }),
}));
vi.mock('../../features/tournament-management/ManagementTab', () => {
  function Stub() {
    useAnnounceCockpitFrame(true);
    return <div data-testid="live-stub" />;
  }
  return { ManagementTab: Stub };
});
vi.mock('../../features/tournament-management/MonitorsConfigTab', () => ({
  MonitorsConfigTab: (props: { onEditMonitor?: (id: string) => void }) => (
    <button type="button" onClick={() => props.onEditMonitor?.('feld-1')}>monitor-bearbeiten</button>
  ),
}));
vi.mock('../../features/tournament-management/MonitorEditor', () => ({ MonitorEditor: () => <div data-testid="monitor-editor-stub" /> }));
vi.mock('../../features/tournament-management/ScheduleTab', () => ({ ScheduleTab: () => <div data-testid="schedule-stub" /> }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => <div data-testid="auth-stub" /> }));
vi.mock('../../features/tournament-management/components/EngineOutboxHeaderStatus', () => ({ EngineOutboxHeaderStatus: () => null }));
vi.mock('../../features/klaerungsliste/KlaerungslisteEinstieg', () => ({ KlaerungslisteEinstieg: () => null })); // B-50: braucht AuthProvider, hier nicht Gegenstand
vi.mock('../../components/ui/Toast', () => ({ useToast: () => ({ showError: vi.fn() }), useOptionalToast: () => null }));

function zeige(pfad: string) {
  return render(
    <MemoryRouter initialEntries={[pfad]}>
      <CockpitFrameProvider>
        <TournamentManagementScreen tournamentId="t-1" onBack={vi.fn()} onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()} />
      </CockpitFrameProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => { mobil.wert = false; resetClosedTournaments(); });
afterEach(() => { resetClosedTournaments(); });

describe('R3-3 Verwaltungsbildschirm nach dem Abschluss (@LZ-036, @LZ-037)', () => {
  it('abgeschlossen: oben steht „Das Turnier ist abgeschlossen“ (Hinweis-Kasten)', async () => {
    setTournamentClosed('t-1', true);
    zeige('/tournament/t-1/schedule');
    expect(await screen.findByTestId('tournament-closed-hint')).toBeInTheDocument();
  });

  it('Gegenbeispiel: offen – kein Hinweis-Kasten', async () => {
    zeige('/tournament/t-1/schedule');
    await screen.findByText('Hallencup Süd');
    expect(screen.queryByTestId('tournament-closed-hint')).not.toBeInTheDocument();
  });

  it('@LZ-037 Z. 4 abgeschlossen: der Monitor-Editor öffnet nicht (reine App-Pflicht, der Server sperrt monitors nicht)', async () => {
    setTournamentClosed('t-1', true);
    zeige('/tournament/t-1/monitor');
    fireEvent.click(await screen.findByText('monitor-bearbeiten'));
    expect(screen.queryByTestId('monitor-editor-stub')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: offen – der Monitor-Editor öffnet', async () => {
    zeige('/tournament/t-1/monitor');
    fireEvent.click(await screen.findByText('monitor-bearbeiten'));
    expect(screen.getByTestId('monitor-editor-stub')).toBeInTheDocument();
  });
});
