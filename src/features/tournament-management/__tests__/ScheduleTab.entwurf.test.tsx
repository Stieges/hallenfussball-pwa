/**
 * Spielplan der Verwaltung, Bearbeiten als Entwurf – echte Kette ScheduleTab → Hooks → Karten, echte deutsche Texte:
 * @ZP-101 ein Tausch über „Tauschen mit …“ wird nicht gespeichert, die Leiste zeigt „1 Änderung nicht gespeichert“,
 * @ZP-100 die Meldung nennt Spielnummern, @ZP-103 „Abbrechen“ fragt, @ZP-102 „Speichern“ speichert einmal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Team, Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

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
  id: 'hallencup-ost', title: 'Hallencup Ost', teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 1,
  refereeConfig: { mode: 'organizer', numberOfReferees: 2 },
});
const schedule = generateFullSchedule(base);
// festgelegtes Turnier: Spiele mit gespeicherter Uhrzeit
const tournament: Tournament = { ...base, matches: schedule.allMatches.map((m) => ({ ...m, scheduledTime: m.startTime })) as unknown as Tournament['matches'] };
const [spiel2, spiel4] = [schedule.allMatches[1], schedule.allMatches[3]];

function renderTab() {
  const onTournamentUpdate = vi.fn();
  render(
    <MemoryRouter><ToastProvider>
      <ScheduleTab tournament={tournament} schedule={schedule} currentStandings={[]}
        onTournamentUpdate={onTournamentUpdate} onLocalTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()} />
    </ToastProvider></MemoryRouter>,
  );
  return onTournamentUpdate;
}

async function tauscheSpiel2MitSpiel4(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('schedule-edit-start'));
  await user.click(screen.getAllByTestId(`swap-with-${spiel2.id}`)[0]);
  await user.selectOptions(screen.getByTestId('swap-with-select'), spiel4.id);
  await user.click(screen.getByRole('button', { name: 'Tauschen' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(localStorage.getItem).mockReturnValue(null);
});

describe('@ZP-101 Spielplan bearbeiten: Änderungen erst nach „Speichern“', () => {
  it('@ZP-101 Tausch über „Tauschen mit …“: nichts gespeichert, Leiste „1 Änderung nicht gespeichert“, Meldung mit Spielnummern (@ZP-100)', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = renderTab();
    await tauscheSpiel2MitSpiel4(user);
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(screen.getByTestId('schedule-unsaved-count').textContent).toBe('1 Änderung nicht gespeichert');
    expect(await screen.findByText(`Spiele ${spiel2.matchNumber} und ${spiel4.matchNumber} getauscht`)).toBeInTheDocument();
  });

  it('@ZP-103 „Abbrechen“ fragt „1 Änderung verwerfen?“; „Weiter bearbeiten“ behält, „Verwerfen“ verwirft ohne Speichern', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = renderTab();
    await tauscheSpiel2MitSpiel4(user);
    await user.click(screen.getByTestId('schedule-edit-cancel'));
    const frage = screen.getByRole('dialog');
    expect(within(frage).getByText('1 Änderung verwerfen?')).toBeInTheDocument();
    await user.click(within(frage).getByRole('button', { name: 'Weiter bearbeiten' }));
    expect(screen.getByTestId('schedule-unsaved-count').textContent).toBe('1 Änderung nicht gespeichert');
    await user.click(screen.getByTestId('schedule-edit-cancel'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verwerfen' }));
    expect(screen.getByTestId('schedule-edit-start')).toBeInTheDocument();
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@ZP-102 „Speichern“ übernimmt den Tausch in einem Update: Spiel 2 und 4 haben Uhrzeit und Feld getauscht', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = renderTab();
    await tauscheSpiel2MitSpiel4(user);
    await user.click(screen.getByTestId('schedule-edit-save'));
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
    const saved = onTournamentUpdate.mock.calls[0][0] as Tournament;
    const zeit = (id: string) => new Date(saved.matches.find((m) => m.id === id)!.scheduledTime!).getTime();
    expect(zeit(spiel2.id)).toBe(spiel4.startTime.getTime());
    expect(zeit(spiel4.id)).toBe(spiel2.startTime.getTime());
  });
});
