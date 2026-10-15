/**
 * A-08f-F (@FU-087, Spielplan Ende-zu-Ende): Wirt = `useTournamentManager` + `ScheduleTab` mit Fake-Repo.
 * Der Turnier-Kanal meldet ueber `realtimeService` (Fake) seinen Zustand. Ist er unterbrochen, laedt
 * `useTournamentManager` alle 5 s nach; die Zeile des ersten Spiels zeigt dann "1:0" -- ohne Hinweis.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { generateFullSchedule } from '../../../core/generators';
import type { Team, Tournament } from '../../../types/tournament';
import type { RealtimeConnectionStatus } from '../../../core/realtime';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ToastProvider } from '../../../components/ui/Toast';

const mockLoadTournament = vi.fn();
vi.mock('../../../core/services/TournamentService', () => {
  class MockTournamentService {
    loadTournament = mockLoadTournament;
    updateTournament = vi.fn();
    schedule = {};
  }
  return { TournamentService: MockTournamentService };
});

const REPOS = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: vi.fn().mockResolvedValue(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: {
    getAll: vi.fn().mockResolvedValue(new Map()), subscribe: vi.fn(), unsubscribe: vi.fn(), unsubscribeAll: vi.fn(),
  },
  publicLiveMatchRepo: null as unknown,
};
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => REPOS }));
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canCorrectResults: true, hasPermission: () => true }),
}));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }));

let reportChannelStatus: (status: RealtimeConnectionStatus) => void = () => undefined;
vi.mock('../../../core/realtime', () => ({
  realtimeService: {
    subscribeTournament: (options: { onStatusChange: (s: RealtimeConnectionStatus) => void }) => {
      reportChannelStatus = options.onStatusChange;
    },
    unsubscribeTournament: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  },
}));

import { ScheduleTab } from '../ScheduleTab';
import { useTournamentManager } from '../../../hooks/useTournamentManager';

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);

function buildTournaments() {
  const base = createMockTournament({
    teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'groupsAndFinals',
    finalsConfig: { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' } },
  });
  const all = generateFullSchedule(base).allMatches as unknown as Tournament['matches'];
  const before: Tournament = { ...base, matches: all };
  const after: Tournament = {
    ...base,
    matches: all.map((m, i) => (i === 0 ? { ...m, scoreA: 1, scoreB: 0, matchStatus: 'finished' } : m)),
  };
  return { before, after };
}

function Host({ tournamentId }: { tournamentId: string }) {
  const { tournament, schedule, currentStandings, handleTournamentUpdate, applyRemote } = useTournamentManager(tournamentId);
  if (!tournament || !schedule) { return null; }
  return (
    <ScheduleTab
      tournament={tournament} schedule={schedule} currentStandings={currentStandings}
      onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }} onLocalTournamentUpdate={applyRemote}
      onMatchesUpdate={vi.fn()}
    />
  );
}

function firstCardText(container: HTMLElement): string {
  return container.querySelector('[data-match-card]')?.textContent ?? '';
}

describe('Spielplan Ende-zu-Ende -- Abfrage-Ausweichen des Turnier-Kanals (A-08f-F, @FU-087)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderHost(before: Tournament) {
    mockLoadTournament.mockResolvedValue(before);
    const view = render(
      <MemoryRouter><ToastProvider><Host tournamentId={before.id} /></ToastProvider></MemoryRouter>,
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    return view;
  }

  it('@FU-087 Pflicht: Kanal CLOSED, Repo liefert 1:0 -> Zeile von Spiel 1 zeigt "1:0" binnen 10 s, kein Hinweis', async () => {
    const { before, after } = buildTournaments();
    const view = await renderHost(before);
    expect(firstCardText(view.container)).not.toContain('1:0');

    act(() => reportChannelStatus('connected'));
    act(() => reportChannelStatus('disconnected'));
    mockLoadTournament.mockResolvedValue(after);

    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(firstCardText(view.container)).toContain('1:0');
    expect(view.queryByText(/Live-Verbindung unterbrochen/)).toBeNull();
  });

  it('@FU-087 Gegenbeispiel: Kanal SUBSCRIBED -> kein Nachladen, Zeile bleibt ohne 1:0', async () => {
    const { before, after } = buildTournaments();
    const view = await renderHost(before);
    const initialLoads = mockLoadTournament.mock.calls.length;

    act(() => reportChannelStatus('connected'));
    mockLoadTournament.mockResolvedValue(after);

    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mockLoadTournament).toHaveBeenCalledTimes(initialLoads);
    expect(firstCardText(view.container)).not.toContain('1:0');
  });

  it('@FU-087 Unmount: Status wird geloescht, ein spaeter CLOSED-Rueckruf bleibt wirkungslos, kein Nachladen', async () => {
    const { before } = buildTournaments();
    const first = await renderHost(before);
    act(() => reportChannelStatus('disconnected'));
    first.unmount();
    const lateCallback = reportChannelStatus;
    const loadsAfterUnmount = mockLoadTournament.mock.calls.length;

    // Spaeter Rueckruf des alten Kanals (removeChannel meldet asynchron CLOSED)
    act(() => lateCallback('disconnected'));
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(mockLoadTournament).toHaveBeenCalledTimes(loadsAfterUnmount);

    // Neu oeffnen: ohne haengendes CLOSED keine Abfrage vor dem ersten Kanalstatus
    await renderHost(before);
    const loadsAfterRemount = mockLoadTournament.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(mockLoadTournament).toHaveBeenCalledTimes(loadsAfterRemount);
  });
});
