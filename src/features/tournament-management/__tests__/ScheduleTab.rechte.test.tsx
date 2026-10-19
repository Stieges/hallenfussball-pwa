/**
 * A-11 @ZP-040 (Record Zeitplan rückt nach): „Wer den Zeitplan ändern darf“ – App-Seite im Spielplan der Verwaltung.
 *
 * Tom (Helfer) bekommt „Spielplan bearbeiten“ (Verschieben, Tauschen, Uhrzeit) und den Schiri-Editor nicht angeboten;
 * „Spiel 13 um 15:12 anpfeifen“ gelingt ihm weiter (Weg ins Cockpit). Gegenbeispiel: Maria (Co-Admin) und Olli
 * (Turnierleitung) bekommen beides angeboten. Echte Kette useCan -> hasPermission, nur die Rolle ist gemockt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Team, Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

const role = vi.hoisted(() => ({ current: 'collaborator' }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: false }),
}));
const mockContext = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: vi.fn().mockResolvedValue(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: { getAll: vi.fn().mockResolvedValue(new Map()), subscribe: vi.fn(), unsubscribe: vi.fn(), unsubscribeAll: vi.fn() },
  publicLiveMatchRepo: null as unknown,
};
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => mockContext }));

import { generateFullSchedule } from '../../../core/generators';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ToastProvider } from '../../../components/ui/Toast';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { ScheduleTab } from '../ScheduleTab';

await initRealDeI18n();

const teams: Team[] = ['SG Mitte', 'VfB Ufer', 'TSV West', 'DJK Berg'].map((name, i) => ({ id: testUuid(i + 1), name, group: 'A' }));
const base = createMockTournament({
  id: 'hallencup-ost', title: 'Hallencup Ost', teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 1,
  refereeConfig: { mode: 'organizer', numberOfReferees: 2 },
});
const schedule = generateFullSchedule(base);
const tournament: Tournament = { ...base, matches: schedule.allMatches as unknown as Tournament['matches'] };
const firstId = schedule.allMatches[0].id;

function renderTab(onNavigateToCockpit = vi.fn()) {
  render(
    <MemoryRouter><ToastProvider>
      <ScheduleTab
        tournament={tournament} schedule={schedule} currentStandings={[]}
        onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()}
        onNavigateToCockpit={onNavigateToCockpit}
      />
    </ToastProvider></MemoryRouter>,
  );
  return onNavigateToCockpit;
}

const editButton = () => screen.queryByRole('button', { name: /Spielplan bearbeiten/ });
const refereeEditor = () => screen.queryByText(/Manuelle Schiedsrichter-Zuweisung/);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(localStorage.getItem).mockReturnValue(null);
});

describe('@ZP-040 Wer den Zeitplan ändern darf – Spielplan der Verwaltung', () => {
  it('@ZP-040 Tom (Helfer): „Spielplan bearbeiten“ und der Schiri-Editor sind nicht angeboten', () => {
    role.current = 'collaborator';
    renderTab();
    expect(editButton()).not.toBeInTheDocument();
    expect(refereeEditor()).not.toBeInTheDocument();
  });

  it('@ZP-040 Tom (Helfer) pfeift Spiel 13 weiter an: der Weg ins Cockpit bleibt', async () => {
    role.current = 'collaborator';
    const user = userEvent.setup();
    const onNavigateToCockpit = renderTab();
    await user.click(screen.getAllByTestId(`match-circle-${firstId}`)[0]);
    await user.click(screen.getAllByTestId('start-match-confirm-btn')[0]);
    expect(onNavigateToCockpit).toHaveBeenCalledWith(firstId);
  });

  it.each(['co-admin', 'owner'])('Gegenbeispiel %s (Maria/Olli): „Spielplan bearbeiten“ und der Schiri-Editor sind angeboten', (r) => {
    role.current = r;
    renderTab();
    expect(editButton()).toBeInTheDocument();
    expect(refereeEditor()).toBeInTheDocument();
  });
});

/**
 * Review A-11 A2 (@ZM-019 „den Aushang zum Drucken erzeugen“, R-A11-5 tournamentSettings) von Ende zu Ende über den
 * Spielplan: der PDF-Dialog wird über den echten Knopf der Werkzeugleiste geöffnet, das Recht kommt aus useCan.
 */
describe('@ZM-019 Aushang zum Drucken – über den Spielplan der Verwaltung', () => {
  async function openPdfDialog() {
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByTestId('schedule-action-pdf'));
    // Positiver Anker: der Dialog steht (Karte „Spielplan“ ist da), erst dann sagt „keine Aushang-Karte“ etwas.
    expect(await screen.findByTestId('pdf-choice-schedule')).toBeInTheDocument();
  }

  it('@ZM-019 Tom (Helfer) öffnet den PDF-Dialog: „Aushang mit QR-Code“ ist nicht angeboten', async () => {
    role.current = 'collaborator';
    await openPdfDialog();
    expect(screen.queryByTestId('pdf-choice-notice')).not.toBeInTheDocument();
    expect(screen.queryByText('Zum Aufhängen')).not.toBeInTheDocument();
  });

  it.each(['co-admin', 'owner'])('Gegenbeispiel @ZM-019 %s (Maria/Olli): die Karte „Aushang mit QR-Code“ ist da', async (r) => {
    role.current = r;
    await openPdfDialog();
    expect(screen.getByTestId('pdf-choice-notice')).toBeInTheDocument();
  });
});
