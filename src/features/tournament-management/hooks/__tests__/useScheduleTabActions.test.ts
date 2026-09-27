/**
 * useScheduleTabActions.test.ts — A2 Fixrunde 1 (Ruling AJ, I2:
 * .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md).
 *
 * The review found NO test for handleScoreChange's A2 behaviour (result entry persists via a
 * targeted UPDATE_MATCH, not a full tournament save) -- this closes that gap, and additionally
 * proves Fixrunde 1's "nur einen Weg" requirement: handleScoreChange now goes through the SAME
 * `diffMatchResultStatusUpdates` helper as every other result/status-changing caller.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tournament, Match } from '../../../../types/tournament';

// P4 (Fixrunde 3): kontrollierbarer Ref-Inhalt fuer `useEngineOverlaidMatchIds` -- steuert, ob ein
// Spiel als "Engine-ueberlagert" (bereits laufendes/beendetes Engine-Spiel MIT echtem Inhalt) gilt.
const overlaidMatchIds = { current: new Set<string>() };
vi.mock('../../../../hooks/useEngineOverlayForTournament', () => ({
  useEngineOverlaidMatchIds: () => overlaidMatchIds,
}));

import { useScheduleTabActions } from '../useScheduleTabActions';

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

function createTournament(matches: Match[], teams: Tournament['teams'] = []): Tournament {
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
    teams,
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
  beforeEach(() => {
    overlaidMatchIds.current = new Set();
    // `localStorage` ist global als `vi.fn()`-Stub gemockt (s. `src/test/setup.dom.ts`) --
    // `mockReturnValue(undefined)` statt `clear()` (waere ebenfalls nur ein Stub-Aufruf).
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

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

  // Fixrunde 2, Item 6: ein B1-Engine-Spiel (scheduled + kein Ergebnis, ECHTE Team-IDs -- nur dann
  // greift buildValidMatches ueberhaupt) darf NICHT mehr ueber die Schnelleingabe direkt
  // scoreA/scoreB geschrieben bekommen (das umginge MatchCommands/die RPC komplett). Die
  // Schnelleingabe zeigt stattdessen denselben "folgt in einem spaeteren Schritt"-Hinweis (C3d).
  it('Fixrunde 2 (Item 6): ein Engine-Spiel (scheduled, kein Ergebnis, echte Teams) blockiert die Schnelleingabe mit Toast statt scoreA/B zu schreiben', () => {
    const teams: Tournament['teams'] = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const tournament = createTournament(
      [createMatch({ id: 'm1', teamA: 'team-a', teamB: 'team-b', matchStatus: 'scheduled' })],
      teams,
    );
    const { result, onMatchesUpdate, onLocalTournamentUpdate, onTournamentUpdate, showWarning } =
      renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 2, 1);
    });

    expect(onMatchesUpdate).not.toHaveBeenCalled();
    expect(onLocalTournamentUpdate).not.toHaveBeenCalled();
    expect(onTournamentUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalled();
  });

  it('Fixrunde 2 (Item 6): dieselben echten Teams, aber ein bereits eingetragenes Ergebnis, bleibt ein normales Altspiel (keine Blockade)', () => {
    const teams: Tournament['teams'] = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const tournament = createTournament(
      [createMatch({ id: 'm1', teamA: 'team-a', teamB: 'team-b', scoreA: 3, scoreB: 1 })],
      teams,
    );
    const { result, onMatchesUpdate } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 5, 5);
    });

    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
  });

  // P4 (Fixrunde 3): die reine B1-Klausel (isNewScheduledMatch mit einer immer LEEREN Map) sah nur
  // NEUE Spiele -- ein bereits laufendes/beendetes Engine-Spiel (matchStatus 'running'/'finished',
  // ECHTER Inhalt in der Engine) wurde faelschlich NICHT erkannt. Die Sperre prueft jetzt zusaetzlich
  // die Engine-Ueberlagerungsmenge (`useEngineOverlaidMatchIds`).
  it('P4: ein LAUFENDES Engine-Spiel (Engine-ueberlagert) wird mit engine.notYet gesperrt (kein onMatchesUpdate)', () => {
    overlaidMatchIds.current = new Set(['m1']);
    const teams: Tournament['teams'] = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const tournament = createTournament(
      [createMatch({ id: 'm1', teamA: 'team-a', teamB: 'team-b', matchStatus: 'running', scoreA: 1, scoreB: 0 })],
      teams,
    );
    const { result, onMatchesUpdate, showWarning } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 5, 5);
    });

    expect(onMatchesUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalled();
  });

  it('P4: ein BEENDETES Engine-Spiel (Engine-ueberlagert) wird mit engine.notYet gesperrt (kein onMatchesUpdate)', () => {
    overlaidMatchIds.current = new Set(['m1']);
    const teams: Tournament['teams'] = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const tournament = createTournament(
      [createMatch({ id: 'm1', teamA: 'team-a', teamB: 'team-b', matchStatus: 'finished', scoreA: 2, scoreB: 1 })],
      teams,
    );
    const { result, onMatchesUpdate, showWarning } = renderActions(tournament, { lockFinishedResults: false });

    act(() => {
      result.current.handleScoreChange('m1', 5, 5);
    });

    expect(onMatchesUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalled();
  });

  // Gegenprobe (P4): ein laufendes 0:0-ALTSPIEL (Altstart setzt kein `matchStatus`, daher
  // `'scheduled'`) ist NICHT Engine-ueberlagert -- es muss den bestehenden Live-Hinweis
  // (`isMatchRunning`/`window.confirm`) zeigen, NICHT den engine.notYet-Toast.
  it('P4 Gegenprobe: ein laufendes 0:0-Altspiel (kein Engine-Overlay, Legacy-isMatchRunning) zeigt den Live-Hinweis statt engine.notYet', () => {
    const teams: Tournament['teams'] = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const tournament = createTournament(
      [createMatch({ id: 'm1', teamA: 'team-a', teamB: 'team-b' })],
      teams,
    );
    // `localStorage` ist in `src/test/setup.dom.ts` global als `vi.fn()`-Stubs gemockt (kein
    // echter Speicher) -- `getItem` direkt auf den erwarteten Wert stellen statt `setItem` zu
    // erwarten.
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ m1: { status: 'RUNNING' } }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result, onMatchesUpdate, showWarning } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 5, 5);
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(showWarning).not.toHaveBeenCalled();
    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  // Minor 5 (Fixrunde 4): ein fremd laufendes Engine-Spiel, dessen Kopie auf DIESEM Geraet noch
  // nicht geladen ist, steht NICHT in `overlaidMatchIds` (das setzt echten Engine-Inhalt voraus)
  // und fiel bisher auf die Legacy-Checks zurueck -- die Schnelleingabe haette am RPC vorbei
  // geschrieben. Dieselbe E1/P2-"unklar"-Einstufung (`isForeignCandidate`) gilt jetzt auch hier.
  it('Minor 5: ein fremd laufendes Engine-Spiel OHNE geladene Kopie (kein Overlay) wird trotzdem mit engine.notYet gesperrt', () => {
    const teams: Tournament['teams'] = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const tournament = createTournament(
      [createMatch({ id: 'm1', teamA: 'team-a', teamB: 'team-b', matchStatus: 'running' })],
      teams,
    );
    const { result, onMatchesUpdate, showWarning } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 5, 5);
    });

    expect(onMatchesUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalled();
  });
});
