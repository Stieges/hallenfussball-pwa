/**
 * useScheduleTabActions.test.ts — A2 Fixrunde 1 (Ruling AJ, I2:
 * .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md).
 *
 * The review found NO test for handleScoreChange's A2 behaviour (result entry persists via a
 * targeted UPDATE_MATCH, not a full tournament save) -- this closes that gap, and additionally
 * proves Fixrunde 1's "nur einen Weg" requirement: handleScoreChange now goes through the SAME
 * `diffMatchResultStatusUpdates` helper as every other result/status-changing caller.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tournament, Match } from '../../../../types/tournament';
import { calculateStandings } from '../../../../utils/calculations';
import { looseVs } from '../../../../test/matchSlotFixtures';

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
    ...looseVs('Team A', 'Team B'),
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
      liveMatchIds: new Set<string>(),
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
    // A-08f2: `matchStatus` running loest den Live-Hinweis aus -- Bestaetigung erteilen.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result, onMatchesUpdate } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 2, 1);
    });

    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
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
      [createMatch({ id: 'm1', ...looseVs('team-a', 'team-b'), matchStatus: 'scheduled' })],
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
      [createMatch({ id: 'm1', ...looseVs('team-a', 'team-b'), scoreA: 3, scoreB: 1 })],
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
      [createMatch({ id: 'm1', ...looseVs('team-a', 'team-b'), matchStatus: 'running', scoreA: 1, scoreB: 0 })],
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
      [createMatch({ id: 'm1', ...looseVs('team-a', 'team-b'), matchStatus: 'finished', scoreA: 2, scoreB: 1 })],
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
  // A-08f2 (@FU-087): "laufend" kommt aus dem Turnier-Spiel (`matchStatus`), nicht aus localStorage.
  // Ein laufendes Spiel ohne lokale Kopie ist ein fremd laufendes Engine-Spiel (Minor 5): es wird
  // mit engine.notYet gesperrt, NICHT ueber window.confirm am RPC vorbeigeschrieben.
  it('P4 (A-08f2): ein laufendes Spiel laut matchStatus wird gesperrt (engine.notYet), kein Confirm, kein Schreiben', () => {
    const teams: Tournament['teams'] = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const tournament = createTournament(
      [createMatch({ id: 'm1', ...looseVs('team-a', 'team-b'), matchStatus: 'running' })],
      teams,
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result, onMatchesUpdate, showWarning } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 5, 5);
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalled();
    expect(onMatchesUpdate).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  // A-08f2 Gegenbeispiel (@FU-087): ein veralteter Eintrag `liveMatches-<id>` (RUNNING) macht ein
  // Spiel, das im Turnier NICHT laufend ist, nicht zu einem laufenden Spiel -- kein Live-Hinweis.
  it('@FU-087 Gegenbeispiel: veralteter localStorage-Eintrag RUNNING, Turnier-Spiel nicht laufend -> kein Live-Hinweis, Ergebnis wird gespeichert', () => {
    const teams: Tournament['teams'] = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const tournament = createTournament(
      [createMatch({ id: 'm1', ...looseVs('team-a', 'team-b'), scoreA: 1, scoreB: 0 })],
      teams,
    );
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ m1: { status: 'RUNNING' } }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result, onMatchesUpdate, showWarning } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 5, 5);
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(showWarning).not.toHaveBeenCalled();
    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
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
      [createMatch({ id: 'm1', ...looseVs('team-a', 'team-b'), matchStatus: 'running' })],
      teams,
    );
    const { result, onMatchesUpdate, showWarning } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 5, 5);
    });

    expect(onMatchesUpdate).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalled();
  });

  // Fixrunde 5 (Regression aus Fixrunde-4-Review, "neuer Important-Befund"): Minor 5 rief
  // `isForeignCandidate` OHNE jeden `matchStatus`-Ausschluss auf -- dadurch galt JEDES Spiel mit
  // `matchStatus !== 'scheduled'` und ohne Ergebnis als "fremder Engine-Kandidat", auch ein
  // uebersprungenes Spiel (`'skipped'`), das nie zur Engine wechselt. Ein solches Spiel muss die
  // Schnelleingabe weiterhin unveraendert durchlassen (Verhalten vor Minor 5).
  it('Fixrunde 5: ein uebersprungenes Spiel (matchStatus skipped) ohne Ergebnis erlaubt die Schnelleingabe', () => {
    const teams: Tournament['teams'] = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const tournament = createTournament(
      [createMatch({ id: 'm1', ...looseVs('team-a', 'team-b'), matchStatus: 'skipped' })],
      teams,
    );
    const { result, onMatchesUpdate, showWarning } = renderActions(tournament);

    act(() => {
      result.current.handleScoreChange('m1', 2, 1);
    });

    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    expect(showWarning).not.toHaveBeenCalled();
  });
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

// Merge I1: ein Spiel mit echten Teams, aber OHNE Ergebnis, ist seit Spur A ein Engine-Spiel und wird für die
// Schnelleingabe gesperrt (Fixrunde 2 Item 6). Die B-40-Fälle gelten für Altspiele mit bereits eingetragenem
// Ergebnis (Korrektur im Spielplan) – deshalb startet das Spiel hier mit 1:0 (0:0 gilt der Engine-Einstufung als „kein Ergebnis“).
const tabellenSpiel = (overrides: Partial<Match> = {}): Match =>
  createMatch({ id: 'm1', group: 'A', ...looseVs('team-a', 'team-b'), scoreA: 1, scoreB: 0, ...overrides });

// @FU-080 / @TM-143 (B-40 Fixrunde 1): Ergebnis direkt im Spielplan eingetragen -> die Tabelle zählt es.
describe('useScheduleTabActions — Ergebnis im Spielplan zählt in der Tabelle (@FU-080, @TM-143)', () => {
  const punkteVon = (turnier: Tournament, name: string) =>
    calculateStandings(turnier.teams, turnier.matches, turnier, 'A').find((s) => s.team.name === name)?.points;

  it('beide Ergebnisse eingetragen: Status finished (lokal und im Payload), Tabelle rechnet mit 3:1', () => {
    const turnier = tabellenTurnier([tabellenSpiel({ matchStatus: 'scheduled' })]);
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

  it('Gegenbeispiel: nur ein ANDERES Spiel läuft laut Live-Quelle -> dieses wird trotzdem finished', () => {
    const turnier = tabellenTurnier([tabellenSpiel({ matchStatus: 'scheduled' })]);
    const { result, onMatchesUpdate } = renderActions(turnier, { liveMatchIds: new Set(['m2']) });

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
// Merge I1: „laufend/pausiert“ kommt aus der Live-Quelle (`liveMatchIds` = useRunningMatchIds/useLiveMatches)
// oder dem Turnierstatus, nicht mehr aus einem eigenen localStorage-Lesen (@FU-087).
describe('useScheduleTabActions — laufend/pausiert bleibt laufend/pausiert (@FU-080, @TM-143)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gespeicherter Status paused bleibt paused, Payload ohne matchStatus', () => {
    const turnier = tabellenTurnier([
      // Die DB kennt 'paused' (matches_match_status_check), der TS-Typ MatchStatus noch nicht.
      tabellenSpiel({ matchStatus: 'paused' as unknown as Match['matchStatus'] }),
    ]);
    const { result, onLocalTournamentUpdate, onMatchesUpdate } = renderActions(turnier);

    act(() => {
      result.current.handleScoreChange('m1', 3, 1);
    });

    const aktualisiert = onLocalTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(aktualisiert.matches[0].matchStatus).toBe('paused');
    expect(onMatchesUpdate.mock.calls[0][0][0]).not.toHaveProperty('matchStatus');
  });

  it('Live-Quelle meldet das Spiel (lokale Halbzeit/Pause) bei Status scheduled -> nicht finished', () => {
    const turnier = tabellenTurnier([tabellenSpiel({ matchStatus: 'scheduled' })]);
    const { result, onLocalTournamentUpdate, onMatchesUpdate } = renderActions(turnier, { liveMatchIds: new Set(['m1']) });

    act(() => {
      result.current.handleScoreChange('m1', 3, 1);
    });

    const aktualisiert = onLocalTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(aktualisiert.matches[0].matchStatus).toBe('scheduled');
    expect(onMatchesUpdate.mock.calls[0][0][0]).not.toHaveProperty('matchStatus');
  });

  it('@FU-087 Gegenbeispiel: ein localStorage-Eintrag RUNNING allein schützt den Status nicht (Live-Quelle leer)', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ m1: { status: 'RUNNING' } }));
    const turnier = tabellenTurnier([tabellenSpiel({ matchStatus: 'scheduled' })]);
    const { result, onMatchesUpdate } = renderActions(turnier);

    act(() => {
      result.current.handleScoreChange('m1', 3, 1);
    });

    expect(onMatchesUpdate.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'm1', matchStatus: 'finished' }),
    ]);
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });
});
