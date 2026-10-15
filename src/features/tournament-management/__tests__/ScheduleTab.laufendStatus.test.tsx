/**
 * A-08f2 (@FU-087): Spielplan markiert laufende Spiele aus dem echten `useLiveMatches` (Fake-Realtime-
 * Repo), nicht aus localStorage. Pflichttest echter Weg: ScheduleTab mit echten Hooks; das Repo meldet
 * das erste Spiel RUNNING -> LiveBadge erscheint; ohne laufendes Spiel im Repo -> kein Live-Kennzeichen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { generateFullSchedule } from '../../../core/generators';
import type { LiveMatch as CoreLiveMatch } from '../../../core/models/LiveMatch';
import type { Team, Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ToastProvider } from '../../../components/ui/Toast';
import { cssVars } from '../../../design-tokens';

const repoMatches = new Map<string, CoreLiveMatch>();
const getAll = vi.fn(async () => new Map(repoMatches));
const mockContext = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: vi.fn().mockResolvedValue(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: { getAll, subscribe: vi.fn(), unsubscribe: vi.fn(), unsubscribeAll: vi.fn() },
  publicLiveMatchRepo: null as unknown,
};
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => mockContext }));
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canCorrectResults: true, hasPermission: () => true }),
}));

import { ScheduleTab } from '../ScheduleTab';

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);

function setup() {
  const base = createMockTournament({
    teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'groupsAndFinals',
    finalsConfig: { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' } },
  });
  const schedule = generateFullSchedule(base);
  const tournament: Tournament = { ...base, matches: schedule.allMatches as unknown as Tournament['matches'] };
  const firstId = schedule.allMatches[0].id;
  return { tournament, schedule, firstId };
}

function renderTab(tournament: Tournament, schedule: ReturnType<typeof generateFullSchedule>) {
  return render(
    <MemoryRouter><ToastProvider>
      <ScheduleTab
        tournament={tournament} schedule={schedule} currentStandings={[]}
        onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} onMatchesUpdate={vi.fn()}
      />
    </ToastProvider></MemoryRouter>,
  );
}

function coreMatch(id: string, status: string): CoreLiveMatch {
  return {
    id, number: 1, phaseLabel: 'Gruppe A', fieldId: 'f1', scheduledKickoff: '2026-10-17T10:00:00Z',
    durationSeconds: 600, version: 1, status, elapsedSeconds: 0, events: [],
    homeTeam: { id: 'h', name: 'Heim' }, awayTeam: { id: 'a', name: 'Gast' }, homeScore: 1, awayScore: 0,
  } as unknown as CoreLiveMatch;
}

describe('ScheduleTab -- laufende Spiele aus useLiveMatches (A-08f2, @FU-087)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMatches.clear();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('@FU-087 Pflicht: Repo meldet das erste Spiel RUNNING -> Live-Kennzeichen im Spielplan', async () => {
    const { tournament, schedule, firstId } = setup();
    repoMatches.set(firstId, coreMatch(firstId, 'RUNNING'));

    const { container } = renderTab(tournament, schedule);
    await act(async () => { await Promise.resolve(); });

    expect(getAll).toHaveBeenCalledWith(tournament.id);
    // LIVE-Kennzeichen der Spielkarte (MatchCard: Hintergrund statusLiveBg nur bei status running)
    await waitFor(() => expect(container.innerHTML).toContain(cssVars.colors.statusLiveBg));
  });

  it('@FU-087 Gegenbeispiel: veralteter localStorage-Eintrag RUNNING, Repo ohne laufendes Spiel -> kein Live-Kennzeichen', async () => {
    const { tournament, schedule, firstId } = setup();
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ [firstId]: { status: 'RUNNING' } }));

    const { container } = renderTab(tournament, schedule);
    await act(async () => { await Promise.resolve(); });

    expect(getAll).toHaveBeenCalled();
    expect(container.innerHTML).not.toContain(cssVars.colors.statusLiveBg);
  });

  it('@FU-087 PAUSED: Repo meldet das Spiel PAUSED (mit Zwischenstand) -> Live-Kennzeichen, nicht "beendet"', async () => {
    const { tournament, schedule, firstId } = setup();
    const withScore: Tournament = {
      ...tournament,
      matches: tournament.matches.map((m) => (m.id === firstId ? { ...m, scoreA: 1, scoreB: 0 } : m)),
    };
    repoMatches.set(firstId, coreMatch(firstId, 'PAUSED'));

    const { container } = renderTab(withScore, schedule);
    await act(async () => { await Promise.resolve(); });

    await waitFor(() => expect(container.innerHTML).toContain(cssVars.colors.statusLiveBg));
  });
});
