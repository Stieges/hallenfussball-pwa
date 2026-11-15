/**
 * @ZP-111 Die Rasteransicht (Umschalter „Tabelle | Grid“) gibt es nur ab 1280 Bildpunkten Breite UND ab zwei Feldern;
 * sonst nur die Liste. Wird das Fenster schmaler, während das Raster gezeigt wird, wechselt der Spielplan auf die Liste –
 * ein Entwurf im Bearbeiten-Modus bleibt dabei erhalten (@ZP-101, @ZP-108).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Team, Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../schedule-editor', () => ({ ScheduleEditor: () => <div data-testid="schedule-editor-stub" /> }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner', isLoading: false }) }));
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
  id: 'hallencup-ost', title: 'Hallencup Ost', teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 2,
  refereeConfig: { mode: 'organizer', numberOfReferees: 2 },
});
const schedule = generateFullSchedule(base);
const zweiFelder: Tournament = { ...base, matches: schedule.allMatches.map((m) => ({ ...m, scheduledTime: m.startTime })) as unknown as Tournament['matches'] };
const einFeld: Tournament = { ...zweiFelder, numberOfFields: 1 };

const fensterBreite = (breite: number) => { Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: breite }); };
const fensterAendern = (breite: number) => { act(() => { fensterBreite(breite); window.dispatchEvent(new Event('resize')); }); };

function renderTab(tournament: Tournament) {
  render(
    <MemoryRouter><ToastProvider>
      <ScheduleTab tournament={tournament} schedule={schedule} currentStandings={[]}
        onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()} />
    </ToastProvider></MemoryRouter>,
  );
}

const umschalter = () => screen.queryByTestId('schedule-view-grid');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(localStorage.getItem).mockReturnValue(null);
  fensterBreite(1024);
});

describe('@ZP-111 Umschalter nur ab 1280 Bildpunkten und ab zwei Feldern', () => {
  it.each([
    ['zwei Felder, 1280 px', 2, 1280, true],
    ['zwei Felder, 1279 px', 2, 1279, false],
    ['zwei Felder, 390 px (Handy)', 2, 390, false],
    ['zwei Felder, 1024 px (Tablet quer)', 2, 1024, false],
    ['ein Feld, 1440 px', 1, 1440, false],
    ['ein Feld, 1280 px', 1, 1280, false],
    ['ein Feld, 390 px', 1, 390, false],
  ])('%s: Umschalter sichtbar = %s', (_n, felder, breite, sichtbar) => {
    fensterBreite(breite);
    renderTab(felder === 1 ? einFeld : zweiFelder);
    expect(umschalter() !== null).toBe(sichtbar);
    expect(screen.queryByTestId('schedule-view-table') !== null).toBe(sichtbar);
    expect(screen.queryByTestId('schedule-editor-stub')).not.toBeInTheDocument();
  });

  it('Wird das Fenster schmaler als 1280 px, während das Raster gezeigt wird, wechselt der Spielplan auf die Liste und der Umschalter verschwindet', async () => {
    const user = userEvent.setup();
    fensterBreite(1280);
    renderTab(zweiFelder);
    await user.click(umschalter()!);
    expect(screen.getByTestId('schedule-editor-stub')).toBeInTheDocument();
    fensterAendern(1279);
    expect(screen.queryByTestId('schedule-editor-stub')).not.toBeInTheDocument();
    expect(umschalter()).not.toBeInTheDocument();
    // wieder breit: die Liste bleibt, das Raster kommt nicht von selbst zurück
    fensterAendern(1440);
    expect(umschalter()).toBeInTheDocument();
    expect(screen.queryByTestId('schedule-editor-stub')).not.toBeInTheDocument();
  });

  it('Im Bearbeiten-Modus bleibt der Entwurf (Zähler, Bearbeiten-Leiste), wenn das Fenster das Raster verlässt', async () => {
    const user = userEvent.setup();
    fensterBreite(1280);
    renderTab(zweiFelder);
    await user.click(screen.getByTestId('schedule-edit-start'));
    await user.click(screen.getAllByTestId(/^swap-with-/)[1]);
    await user.selectOptions(screen.getByTestId('swap-with-select'), screen.getByTestId('swap-with-select').querySelectorAll('option')[1].getAttribute('value')!);
    await user.click(screen.getByRole('button', { name: 'Tauschen' }));
    expect(screen.getByTestId('schedule-unsaved-count').textContent).toBe('1 Änderung nicht gespeichert');
    await user.click(umschalter()!);
    expect(screen.getByTestId('schedule-editor-stub')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-unsaved-count').textContent).toBe('1 Änderung nicht gespeichert');
    fensterAendern(1000);
    expect(screen.queryByTestId('schedule-editor-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('schedule-unsaved-count').textContent).toBe('1 Änderung nicht gespeichert');
    expect(screen.getByTestId('schedule-edit-save')).toBeInTheDocument();
  });
});
