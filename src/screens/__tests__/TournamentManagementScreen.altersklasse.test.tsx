/**
 * Kopf der Turnierverwaltung (ManagementChrome): Altersklasse (Record Wizard-Regelprofile @W2B-022, @W2B-024, @W2B-026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CockpitFrameProvider } from '../../components/live-cockpit/frame/CockpitFrameContext';
import { useAnnounceCockpitFrame } from '../../components/live-cockpit/frame/cockpitFrame';
import { TournamentManagementScreen } from '../TournamentManagementScreen';

const mobil = vi.hoisted(() => ({ wert: false }));
const verwaltung = vi.hoisted(() => ({
  tournament: { id: 't-1', title: 'Hallencup Süd', ageClass: '', date: '2026-11-28', numberOfFields: 1, teams: [], matches: [] },
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

describe('Altersklasse im Kopf der Turnierverwaltung (@W2B-022, @W2B-024, @W2B-026)', () => {
  beforeEach(() => { mobil.wert = false; });

  async function untertitel(ageClass: string): Promise<string> {
    verwaltung.tournament.ageClass = ageClass;
    zeige('/tournament/t-1/schedule');
    const title = await screen.findByText('Hallencup Süd');
    return title.nextElementSibling?.textContent ?? '';
  }

  it('@W2B-022 ohne Altersklasse beginnt die Zeile nicht mit einem Trennzeichen', async () => {
    const text = await untertitel('');
    expect(text.trim()).not.toBe('');
    expect(text.trim().startsWith('\u00b7')).toBe(false);
  });

  it.each(['U11', 'AH'])('@W2B-024 @W2B-026 „%s“ steht genau so davor', async (wert) => {
    expect((await untertitel(wert)).startsWith(`${wert} \u00b7 `)).toBe(true);
  });
});
