/**
 * R3-3 Spielplan der Verwaltung nach dem Abschluss: Zeiten verschieben (B-26), Spielplan bearbeiten / Schedule Editor,
 * Schiedsrichter-Zuweisung, Ergebnis/Schiri/Feld in der Tabelle, Nichtantritt (B-12), Spiel im Spielplan beenden (#337).
 * Szenarien: @ZP-087 „Nach dem Abschluss ändert niemand den Zeitplan“, @LZ-036 Z. 3–5. Gegenbeispiel: dasselbe Turnier offen.
 * Echte Kette useCan -> hasPermission; nur die Rolle (Eigentümer) und die Tabelle (Attrappe) sind gemockt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Team, Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));
// Der Spielplan der Tabelle: hier nur, WELCHE Eingaben die Verwaltung ihm gibt (Ergebnis, Schiri, Feld, Nichtantritt)
vi.mock('../../schedule-editor', () => ({ ScheduleEditor: () => <div data-testid="schedule-editor-stub" /> }));
const displayProps = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }));
vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: (props: Record<string, unknown>) => { displayProps.current = props; return null; },
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
import { setTournamentClosed, resetClosedTournaments } from '../../../core/services/closedTournaments';

await initRealDeI18n();

const teams: Team[] = ['SG Mitte', 'VfB Ufer', 'TSV West', 'DJK Berg'].map((name, i) => ({ id: testUuid(i + 1), name, group: 'A' }));
const base = createMockTournament({
  id: 'hallencup-ost', title: 'Hallencup Ost', teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 1,
  refereeConfig: { mode: 'organizer', numberOfReferees: 2 },
});
const schedule = generateFullSchedule(base);
const tournament: Tournament = { ...base, matches: schedule.allMatches as unknown as Tournament['matches'] };

function renderTab() {
  render(
    <MemoryRouter><ToastProvider>
      <ScheduleTab
        tournament={tournament} schedule={schedule} currentStandings={[]}
        onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()}
        onNavigateToCockpit={vi.fn()}
      />
    </ToastProvider></MemoryRouter>,
  );
}

const editButton = () => screen.queryByTestId('schedule-edit-start');
const shiftButton = () => screen.queryByTestId('schedule-shift-button');
const refereeEditor = () => screen.queryByText(/Manuelle Schiedsrichter-Zuweisung/);

beforeEach(() => { vi.clearAllMocks(); vi.mocked(localStorage.getItem).mockReturnValue(null); resetClosedTournaments(); displayProps.current = {}; });
afterEach(() => { resetClosedTournaments(); });

describe('@ZP-087 @LZ-036 Spielplan nach dem Abschluss: ändert niemand den Zeitplan', () => {
  it('abgeschlossen: „Spielplan bearbeiten“, „Zeiten verschieben“ (B-26) und der Schiri-Editor sind nicht angeboten', () => {
    setTournamentClosed('hallencup-ost', true);
    renderTab();
    expect(editButton()).not.toBeInTheDocument();
    expect(shiftButton()).not.toBeInTheDocument();
    expect(refereeEditor()).not.toBeInTheDocument();
  });

  it('abgeschlossen: Ergebnis eintragen, Schiri und Feld im Spielplan, Nichtantritt (B-12) bekommen keine Eingabe', () => {
    setTournamentClosed('hallencup-ost', true);
    renderTab();
    expect(displayProps.current.editable).toBe(false);
    expect(displayProps.current.onScoreChange).toBeUndefined();
    expect(displayProps.current.onRefereeChange).toBeUndefined();
    expect(displayProps.current.onFieldChange).toBeUndefined();
    expect(displayProps.current.forfeit).toBeUndefined();
  });

  it('Gegenbeispiel: offen – bearbeiten, verschieben, Schiri-Editor da; Ergebnis, Schiri und Feld sind eingebunden', () => {
    renderTab();
    expect(editButton()).toBeInTheDocument();
    expect(shiftButton()).toBeInTheDocument();
    expect(refereeEditor()).toBeInTheDocument();
    expect(displayProps.current.editable).toBe(true);
    expect(typeof displayProps.current.onScoreChange).toBe('function');
    expect(typeof displayProps.current.onRefereeChange).toBe('function');
    expect(typeof displayProps.current.onFieldChange).toBe('function');
    expect(displayProps.current.forfeit).toBeDefined();
  });

  it('der Abschluss mitten in der Ansicht (anderes Gerät schließt ab) nimmt die Angebote sofort weg', () => {
    renderTab();
    expect(editButton()).toBeInTheDocument();
    act(() => setTournamentClosed('hallencup-ost', true));
    expect(editButton()).not.toBeInTheDocument();
    expect(displayProps.current.onScoreChange).toBeUndefined();
  });

  it('die Gitter-Ansicht (Schedule Editor) wird abgeschlossen nicht mehr gezeigt, auch wenn sie vorher gewählt war', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByTestId('schedule-view-grid'));
    expect(screen.getByTestId('schedule-editor-stub')).toBeInTheDocument();
    act(() => setTournamentClosed('hallencup-ost', true));
    expect(screen.queryByTestId('schedule-editor-stub')).not.toBeInTheDocument();
    expect(displayProps.current.editable).toBe(false);
  });

  it('@LZ-037 Z. 5 abgeschlossen: „Aushang mit QR-Code“ im PDF-Dialog bleibt angeboten (druckt nur den Link der öffentlichen Ansicht)', async () => {
    const user = userEvent.setup();
    setTournamentClosed('hallencup-ost', true);
    renderTab();
    await user.click(screen.getByTestId('schedule-action-pdf'));
    expect(await screen.findByTestId('pdf-choice-schedule')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-choice-notice')).toBeInTheDocument();
  });
});
