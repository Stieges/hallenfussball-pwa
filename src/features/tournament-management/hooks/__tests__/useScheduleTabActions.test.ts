/**
 * useScheduleTabActions.test.ts — A2 Fixrunde 1 (Ruling AJ, I2:
 * .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md).
 *
 * The review found NO test for handleScoreChange's A2 behaviour (result entry persists via a
 * targeted UPDATE_MATCH, not a full tournament save) -- this closes that gap, and additionally
 * proves Fixrunde 1's "nur einen Weg" requirement: handleScoreChange now goes through the SAME
 * `diffMatchResultStatusUpdates` helper as every other result/status-changing caller.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScheduleTabActions } from '../useScheduleTabActions';
import type { Tournament, Match } from '../../../../types/tournament';
import { calculateStandings } from '../../../../utils/calculations';
import { STORAGE_KEYS } from '../../../../constants/storage';

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    round: 1,
    field: 1,
    teamA: 'Team A',
    teamB: 'Team B',
    ...overrides,
  };
}

function createTournament(matches: Match[]): Tournament {
  return {
    id: 'test-tournament',
    title: 'Test Tournament',
    sport: 'hallenfussball',
    tournamentType: 'group_only',
    status: 'published',
    date: '2026-01-01',
    location: { name: '' },
    numberOfFields: 1,
    numberOfTeams: 2,
    numberOfGroups: 1,
    groupPhaseGameDuration: 10,
    pointSystem: { win: 3, draw: 1, loss: 0 },
    teams: [],
    matches,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Tournament;
}

function renderActions(tournament: Tournament, overrides: Partial<Parameters<typeof useScheduleTabActions>[0]> = {}) {
  const onTournamentUpdate = vi.fn();
  const onLocalTournamentUpdate = vi.fn();
  const onMatchesUpdate = vi.fn();
  const showSuccess = vi.fn();
  const showWarning = vi.fn();
  const saveToHistory = vi.fn();
  const setPendingReferee = vi.fn();
  const setPendingField = vi.fn();

  const { result } = renderHook(() =>
    useScheduleTabActions({
      tournament,
      onTournamentUpdate,
      onLocalTournamentUpdate,
      onMatchesUpdate,
      isEditing: false,
      saveToHistory,
      showSuccess,
      showWarning,
      setPendingReferee,
      setPendingField,
      lockFinishedResults: false,
      ...overrides,
    })
  );

  return { result, onTournamentUpdate, onLocalTournamentUpdate, onMatchesUpdate, showWarning };
}

describe('useScheduleTabActions — handleScoreChange (A2 Fixrunde 1)', () => {
  it('persists the result via onMatchesUpdate (UPDATE_MATCH), never a full onTournamentUpdate save', () => {
    const tournament = createTournament([createMatch({ id: 'm1' })]);
    const { result, onTournamentUpdate, onLocalTournamentUpdate, onMatchesUpdate } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 2, 1);
    });

    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(onLocalTournamentUpdate).toHaveBeenCalledTimes(1);

    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    const updates = onMatchesUpdate.mock.calls[0][0];
    expect(updates).toEqual([
      expect.objectContaining({ id: 'm1', scoreA: 2, scoreB: 1 }),
    ]);
  });

  // A2 Fixrunde 3 (N1a, .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-rereview.md):
  // the exact scenario the review flagged -- the owner enters a result for a match that is
  // currently RUNNING (e.g. a helper's live match) via the "trotzdem eintragen" confirm
  // (`liveMatchWarning`). Only scoreA/scoreB may go out; matchStatus/timer must NOT be
  // overwritten with the owner's local (possibly stale) copy of them.
  it('entering a score for a RUNNING match sends ONLY scoreA/scoreB -- never matchStatus or the timer', () => {
    const tournament = createTournament([
      createMatch({
        id: 'm1',
        matchStatus: 'running',
        timerStartTime: '2026-01-01T10:00:00Z',
        timerElapsedSeconds: 300,
      }),
    ]);
    const { result, onMatchesUpdate } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 2, 1);
    });

    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    const updates = onMatchesUpdate.mock.calls[0][0];
    expect(updates).toEqual([{ id: 'm1', scoreA: 2, scoreB: 1 }]);
    expect(updates[0]).not.toHaveProperty('matchStatus');
    expect(updates[0]).not.toHaveProperty('timerStartTime');
    expect(updates[0]).not.toHaveProperty('timerElapsedSeconds');
  });

  it('does nothing when the match is already finished and results are locked', () => {
    const tournament = createTournament([
      createMatch({ id: 'm1', scoreA: 1, scoreB: 1, matchStatus: 'finished' }),
    ]);
    const { result, onMatchesUpdate, showWarning } = renderActions(tournament, { lockFinishedResults: true });

    act(() => {
      result.current.handleScoreChange('m1', 5, 5);
    });

    expect(onMatchesUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalled();
  });
});

// localStorage ist in der DOM-Testumgebung ein vi.fn-Mock (src/test/setup.dom.ts): der Live-Store
// wird deshalb über getItem gestellt.
function stubLiveStore(eintraege: Record<string, { status: string }>): void {
  vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
    key === STORAGE_KEYS.liveMatches('test-tournament') ? JSON.stringify(eintraege) : null
  );
}

afterEach(() => {
  vi.mocked(localStorage.getItem).mockReset();
});

// Turnier mit zwei Teams in Gruppe A, damit die Tabelle (calculateStandings) rechnen kann.
const tabellenTurnier = (matches: Match[]): Tournament => (({
  ...createTournament(matches),
  teams: [
    { id: 'team-a', name: 'Team A', group: 'A' },
    { id: 'team-b', name: 'Team B', group: 'A' },
  ],
  placementLogic: [{ id: 'points', label: 'Punkte', enabled: true }],
}));

// @FU-080 / @TM-143 (B-40 Fixrunde 1): Ergebnis direkt im Spielplan eingetragen -> die Tabelle zählt es.
describe('useScheduleTabActions — Ergebnis im Spielplan zählt in der Tabelle (@FU-080, @TM-143)', () => {
  const punkteVon = (turnier: Tournament, name: string) =>
    calculateStandings(turnier.teams, turnier.matches, turnier, 'A').find((s) => s.team.name === name)?.points;

  it('beide Ergebnisse eingetragen: Status finished (lokal und im Payload), Tabelle rechnet mit 3:1', () => {
    const turnier = tabellenTurnier([
      createMatch({ id: 'm1', group: 'A', teamA: 'Team A', teamB: 'Team B' }),
    ]);
    const { result, onLocalTournamentUpdate, onMatchesUpdate } = renderActions(turnier);

    act(() => {
      result.current.handleScoreChange('m1', 3, 1);
    });

    const aktualisiert = onLocalTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(aktualisiert.matches[0].matchStatus).toBe('finished');
    expect(onMatchesUpdate.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'm1', scoreA: 3, scoreB: 1, matchStatus: 'finished' }),
    ]);
    expect(punkteVon(aktualisiert, 'Team A')).toBe(3);
    expect(punkteVon(aktualisiert, 'Team B')).toBe(0);
  });

  it('Gegenbeispiel: Live-Store NOT_STARTED (initialisiert, nicht gespielt) -> trotzdem finished', () => {
    stubLiveStore({ m1: { status: 'NOT_STARTED' } });
    const turnier = tabellenTurnier([
      createMatch({ id: 'm1', group: 'A', teamA: 'Team A', teamB: 'Team B', matchStatus: 'scheduled' }),
    ]);
    const { result, onMatchesUpdate } = renderActions(turnier);

    act(() => {
      result.current.handleScoreChange('m1', 3, 1);
    });

    expect(onMatchesUpdate.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'm1', matchStatus: 'finished' }),
    ]);
  });
});

// B-40 Fixrunde 2 (W2/H1): echte Schutzklauseln über den Hook. Laufend oder pausiert darf durch einen
// Spielplan-Eintrag nicht zu `finished` werden; der Status bleibt stehen.
describe('useScheduleTabActions — laufend/pausiert bleibt laufend/pausiert (@FU-080, @TM-143)', () => {
  afterEach(() => {
    vi.mocked(localStorage.getItem).mockReset();
    vi.restoreAllMocks();
  });

  it('gespeicherter Status paused bleibt paused, Payload ohne matchStatus', () => {
    const turnier = tabellenTurnier([
      createMatch({ id: 'm1', group: 'A', teamA: 'Team A', teamB: 'Team B', matchStatus: 'paused' }),
    ]);
    const { result, onLocalTournamentUpdate, onMatchesUpdate } = renderActions(turnier);

    act(() => {
      result.current.handleScoreChange('m1', 3, 1);
    });

    const aktualisiert = onLocalTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(aktualisiert.matches[0].matchStatus).toBe('paused');
    expect(onMatchesUpdate.mock.calls[0][0][0]).not.toHaveProperty('matchStatus');
  });

  it('Live-Store PAUSED (lokale Halbzeit) bei Status scheduled führt nicht zu finished', () => {
    stubLiveStore({ m1: { status: 'PAUSED' } });
    const turnier = tabellenTurnier([
      createMatch({ id: 'm1', group: 'A', teamA: 'Team A', teamB: 'Team B', matchStatus: 'scheduled' }),
    ]);
    const { result, onLocalTournamentUpdate, onMatchesUpdate } = renderActions(turnier);

    act(() => {
      result.current.handleScoreChange('m1', 3, 1);
    });

    const aktualisiert = onLocalTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(aktualisiert.matches[0].matchStatus).toBe('scheduled');
    expect(onMatchesUpdate.mock.calls[0][0][0]).not.toHaveProperty('matchStatus');
  });

  it('Live-Store RUNNING bei Status scheduled führt nicht zu finished (nach „trotzdem eintragen“)', () => {
    stubLiveStore({ m1: { status: 'RUNNING' } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const turnier = tabellenTurnier([
      createMatch({ id: 'm1', group: 'A', teamA: 'Team A', teamB: 'Team B', matchStatus: 'scheduled' }),
    ]);
    const { result, onLocalTournamentUpdate, onMatchesUpdate } = renderActions(turnier);

    act(() => {
      result.current.handleScoreChange('m1', 3, 1);
    });

    const aktualisiert = onLocalTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(aktualisiert.matches[0].matchStatus).toBe('scheduled');
    expect(onMatchesUpdate.mock.calls[0][0][0]).not.toHaveProperty('matchStatus');
  });
});
