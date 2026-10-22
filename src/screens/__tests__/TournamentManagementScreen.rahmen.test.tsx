/**
 * Rahmen im laufenden Spiel am Bildschirm der Turnierverwaltung (Plan LT-2, Entscheidung A1, @SL-140): Meldet der Live-Reiter den Rahmen,
 * entfallen App-Kopf, Reiter und mobile Navigation; in jedem anderen Reiter und ohne Rahmen bleiben sie. Der Reiter selbst ist ein Stub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CockpitFrameProvider } from '../../components/live-cockpit/frame/CockpitFrameContext';
import { useAnnounceCockpitFrame } from '../../components/live-cockpit/frame/cockpitFrame';
import { TournamentManagementScreen } from '../TournamentManagementScreen';

const mobil = vi.hoisted(() => ({ wert: false }));
const verwaltung = vi.hoisted(() => ({
  tournament: { id: 't-1', title: 'Hallencup Süd', ageClass: 'U11', date: '2026-11-28', numberOfFields: 1, teams: [], matches: [] },
  schedule: { allMatches: [], phases: [], teams: [] },
}));
// GA4 A-13c: Spielplan und Tabellen liegen unter den Anbietern für „Gruppe abschließen“ (Rechte, Repositories); hier nur die Hülle des Bildschirms
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
vi.mock('../../features/tournament-management/ScheduleTab', () => ({ ScheduleTab: () => <div data-testid="schedule-stub" /> }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => <div data-testid="auth-stub" /> }));
vi.mock('../../features/tournament-management/components/EngineOutboxHeaderStatus', () => ({ EngineOutboxHeaderStatus: () => null }));
vi.mock('../../components/ui/Toast', () => ({ useToast: () => ({ showError: vi.fn() }) }));

function zeige(pfad: string) {
  return render(
    <MemoryRouter initialEntries={[pfad]}>
      <CockpitFrameProvider>
        <TournamentManagementScreen tournamentId="t-1" onBack={vi.fn()} onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()} />
      </CockpitFrameProvider>
    </MemoryRouter>,
  );
}

describe('@SL-140 Rahmen am Bildschirm der Turnierverwaltung', () => {
  beforeEach(() => { mobil.wert = false; });

  it('@SL-140 Live-Reiter mit Spiel: kein App-Kopf, keine Reiter (Desktop)', async () => {
    zeige('/tournament/t-1/live');
    expect(await screen.findByTestId('live-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-tab-spielplan')).toBeNull();
    expect(screen.queryByTestId('auth-stub')).toBeNull();
    expect(screen.queryByText('Hallencup Süd')).toBeNull();
  });

  it('@SL-140 Live-Reiter mit Spiel am Handy: keine mobile Navigation', async () => {
    mobil.wert = true;
    zeige('/tournament/t-1/live');
    expect(await screen.findByTestId('live-stub')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('@SL-140 Gegenbeispiel: im Spielplan-Reiter stehen App-Kopf und Reiter', async () => {
    zeige('/tournament/t-1/schedule');
    expect(await screen.findByTestId('schedule-stub')).toBeInTheDocument();
    expect(screen.getByTestId('desktop-tab-spielplan')).toBeInTheDocument();
    expect(screen.getByTestId('auth-stub')).toBeInTheDocument();
    expect(screen.getByText('Hallencup Süd')).toBeInTheDocument();
  });

  it('@SL-140 Gegenbeispiel Handy: im Spielplan-Reiter steht die mobile Navigation', async () => {
    mobil.wert = true;
    zeige('/tournament/t-1/schedule');
    expect(await screen.findByTestId('schedule-stub')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
