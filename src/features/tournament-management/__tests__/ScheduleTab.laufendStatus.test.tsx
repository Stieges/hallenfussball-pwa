/**
 * A-36c (@ZM-039, @ZM-040, C-ZUSCHAUER-LIVE-ALS-BEENDET; vorher A-08f2/@FU-087): der Spielplan der Leitung hat EINE Statusquelle,
 * die gemeinsame Ansicht (Zwischenspeicher des Spiels, Engine vorn). Ein laufendes Spiel steht als laufend da – auch mit
 * Zwischenstand und ohne Eintrag im Alt-Live-Speicher; „hat Stand“ macht kein Spiel zu „beendet“.
 * Pflichttest echter Weg: ScheduleTab mit echten Hooks.
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
// A-08f3e2: die Schnelleingabe fragt die Akteursrolle ab (useActorRole braucht sonst den AuthProvider).
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
// A-11: Rechte nur über useCan (der Stub usePermissions ist gelöscht) -- hier die Turnierleitung, alles erlaubt.
vi.mock('../../auth/hooks/useCan', () => ({ useCan: () => true }));

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

describe('ScheduleTab -- Status aus der Ansicht (A-36c, @ZM-039/@ZM-040, @FU-087)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMatches.clear();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  const mitStatus = (tournament: Tournament, id: string, over: Partial<Tournament['matches'][number]>): Tournament => ({
    ...tournament,
    matches: tournament.matches.map((m) => (m.id === id ? { ...m, ...over } : m)),
  });

  it('@ZM-039 Pflicht: Spiel mit Status „läuft“ im Turnier -> Live-Kennzeichen im Spielplan, ohne Eintrag im Alt-Live-Speicher', async () => {
    const { tournament, schedule, firstId } = setup();
    const { container } = renderTab(mitStatus(tournament, firstId, { matchStatus: 'running', scoreA: 1, scoreB: 0 }), schedule);
    await act(async () => { await Promise.resolve(); });

    // LIVE-Kennzeichen der Spielkarte (Hintergrund statusLiveBg nur bei Status läuft)
    await waitFor(() => expect(container.innerHTML).toContain(cssVars.colors.statusLiveBg));
    expect(container.querySelectorAll('[data-testid="match-card-live"]')).toHaveLength(1);
  });

  it('@ZM-039 Gegenbeispiel: veralteter localStorage-Eintrag RUNNING, Spiel im Turnier geplant -> kein Live-Kennzeichen', async () => {
    const { tournament, schedule, firstId } = setup();
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ [firstId]: { status: 'RUNNING' } }));

    const { container } = renderTab(tournament, schedule);
    await act(async () => { await Promise.resolve(); });

    expect(container.innerHTML).not.toContain(cssVars.colors.statusLiveBg);
  });

  it('@ZM-040 Gegenbeispiel: nur der Alt-Live-Speicher meldet RUNNING, das Spiel im Turnier ist geplant -> kein Live-Kennzeichen (eine Quelle)', async () => {
    const { tournament, schedule, firstId } = setup();
    repoMatches.set(firstId, coreMatch(firstId, 'RUNNING'));

    const { container } = renderTab(tournament, schedule);
    await act(async () => { await Promise.resolve(); });

    expect(container.innerHTML).not.toContain(cssVars.colors.statusLiveBg);
  });

  it('@ZM-039 „hat Stand“ macht kein Spiel beendet: Zwischenstand 1:0 und Status „läuft“ -> laufend, nicht beendet', async () => {
    const { tournament, schedule, firstId } = setup();
    const { container } = renderTab(mitStatus(tournament, firstId, { matchStatus: 'running', scoreA: 1, scoreB: 0 }), schedule);
    await act(async () => { await Promise.resolve(); });

    for (const circle of container.querySelectorAll(`[data-testid="match-circle-${firstId}"]`)) {
      expect(circle).toHaveAttribute('data-match-status', 'running');
    }
  });

  it('Gegenbeispiel: beendetes Spiel (Status „beendet“, 2:1) bleibt beendet mit Stand', async () => {
    const { tournament, schedule, firstId } = setup();
    const { container } = renderTab(mitStatus(tournament, firstId, { matchStatus: 'finished', scoreA: 2, scoreB: 1 }), schedule);
    await act(async () => { await Promise.resolve(); });

    for (const circle of container.querySelectorAll(`[data-testid="match-circle-${firstId}"]`)) {
      expect(circle).toHaveAttribute('data-match-status', 'finished');
      expect(circle.textContent).toBe('2:1');
    }
    expect(container.innerHTML).not.toContain(cssVars.colors.statusLiveBg);
  });
});
