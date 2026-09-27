/**
 * useTournamentManager x useEngineOverlayForTournament (C3a-2a, W7): Engine-Ergebnisse fliessen
 * NUR lokal in die Turnier-Ausgabe -- kein Versionssprung, kein `syncUp` (Spy auf
 * `TournamentService.updateTournament` bleibt unberuehrt, solange niemand `handleTournamentUpdate`
 * aufruft), Ueberlagerung reagiert auf `engine.subscribe`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';
import { useTournamentManager } from '../useTournamentManager';

const mockLoadTournament = vi.fn();
const mockUpdateTournament = vi.fn();

vi.mock('../../core/services/TournamentService', () => {
  class MockTournamentService {
    loadTournament = mockLoadTournament;
    updateTournament = mockUpdateTournament;
    schedule = {};
  }
  return { TournamentService: MockTournamentService };
});

const STABLE_TOURNAMENT_REPOSITORY = {};
vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ tournamentRepository: STABLE_TOURNAMENT_REPOSITORY, isRealtimeEnabled: false }),
}));
vi.mock('../useRealtimeTournament', () => ({
  useRealtimeTournament: () => ({ isConnected: false, status: 'disconnected' }),
}));

let listeners: Array<() => void> = [];
const mockView = vi.fn();
const mockEngineContext: { engine: { view: typeof mockView; subscribe: (l: () => void) => () => void } } = {
  engine: {
    view: mockView,
    subscribe: (listener: () => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
  },
};
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => mockEngineContext,
}));

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'tour-overlay',
    matches: [
      {
        id: 'm1',
        round: 1,
        field: 1,
        teamA: 'teamA',
        teamB: 'teamB',
        scoreA: 0,
        scoreB: 0,
        matchStatus: 'scheduled',
        scheduledTime: new Date('2026-09-27T10:00:00.000Z'),
      },
    ],
    teams: [
      { id: 'teamA', name: 'Heim' },
      { id: 'teamB', name: 'Gast' },
    ],
    placementLogic: [],
    groupPhaseGameDuration: 20,
    pointSystem: { win: 3, draw: 1, loss: 0 },
    numberOfFields: 1,
    version: 5,
    ...overrides,
  } as unknown as Tournament;
}

describe('useTournamentManager x useEngineOverlayForTournament (W7)', () => {
  beforeEach(() => {
    listeners = [];
    mockView.mockReset().mockReturnValue(null);
    mockLoadTournament.mockReset();
    mockUpdateTournament.mockReset();
  });

  it('ueberlagert scoreA/scoreB aus der Engine-Ansicht, sobald diese Ereignisse hat', async () => {
    mockLoadTournament.mockResolvedValue(makeTournament());
    const { result, rerender } = renderHook(() => useTournamentManager('tour-overlay'));

    await waitFor(() => expect(result.current.tournament).not.toBeNull());
    expect(result.current.tournament?.matches[0].scoreA).toBe(0);

    mockView.mockReturnValue({
      result: {
        state: {
          status: 'running',
          phase: 'regular',
          scores: { teama: { regular: 2, overtime: 0, shootout: 0 }, teamb: { regular: 1, overtime: 0, shootout: 0 } },
          overrides: [],
          baseDecidedBy: null,
          decidedBy: null,
          finishedAt: null,
          clock: { running: true, elapsedMs: 0, anchorAt: null },
        },
        localRejected: [],
        needsFullReload: false,
      },
      log: [{ id: 'g1', type: 'GOAL' }],
      confirmedCount: 1,
    });
    // W7: die Ueberlagerung reagiert auf engine.subscribe, nicht nur auf einen neuen `tournament`.
    act(() => {
      listeners.forEach((listener) => listener());
    });
    rerender();

    await waitFor(() => expect(result.current.tournament?.matches[0].scoreA).toBe(2));
    expect(result.current.tournament?.matches[0].scoreB).toBe(1);
    // Rein lokal: KEIN Speicherpfad ausgeloest.
    expect(mockUpdateTournament).not.toHaveBeenCalled();
  });

  it('C1-artige Regression (E2E "Can score a goal"): eine WEITERE Benachrichtigung mit UNVERAENDERTER Projektion liefert dieselbe matches-Referenz (kein Endlos-Renderzyklus)', async () => {
    mockLoadTournament.mockResolvedValue(makeTournament());
    const { result, rerender } = renderHook(() => useTournamentManager('tour-overlay'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    mockView.mockReturnValue({
      result: {
        state: {
          status: 'running',
          phase: 'regular',
          scores: { teama: { regular: 1, overtime: 0, shootout: 0 }, teamb: { regular: 0, overtime: 0, shootout: 0 } },
          overrides: [],
          baseDecidedBy: null,
          decidedBy: null,
          finishedAt: null,
          clock: { running: true, elapsedMs: 0, anchorAt: null },
        },
        localRejected: [],
        needsFullReload: false,
      },
      log: [{ id: 'g1', type: 'GOAL' }],
      confirmedCount: 1,
    });
    act(() => {
      listeners.forEach((listener) => listener());
    });
    rerender();
    await waitFor(() => expect(result.current.tournament?.matches[0].scoreA).toBe(1));
    const matchesAfterFirstNotify = result.current.tournament?.matches;

    // Ein ZWEITER, inhaltlich identischer Benachrichtigungszyklus (z. B. durch eine andere
    // Aenderung an einem unbeteiligten Spiel ausgeloest) darf KEINE neue `matches`-Array-Referenz
    // erzeugen -- ohne den Fix wich die Projektion bei JEDER Neuberechnung von den STATISCHEN
    // Rohdaten ('scheduled'/0:0) ab und baute jedes Mal ein neues Array (Endlos-Renderzyklus mit
    // dem Lade-Effekt in useMatchExecution.ts, dessen Abhaengigkeit `tournament.matches` ist).
    act(() => {
      listeners.forEach((listener) => listener());
    });
    rerender();

    expect(result.current.tournament?.matches).toBe(matchesAfterFirstNotify);
  });

  it('I3 (Pflichttest W7): kein Versionssprung -- version bleibt der ROHE Wert, egal was das Overlay schreibt', async () => {
    mockLoadTournament.mockResolvedValue(makeTournament());
    const { result, rerender } = renderHook(() => useTournamentManager('tour-overlay'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());
    expect(result.current.tournament?.version).toBe(5);

    mockView.mockReturnValue({
      result: {
        state: {
          status: 'running',
          phase: 'regular',
          scores: { teama: { regular: 3, overtime: 0, shootout: 0 }, teamb: { regular: 0, overtime: 0, shootout: 0 } },
          overrides: [],
          baseDecidedBy: null,
          decidedBy: null,
          finishedAt: null,
          clock: { running: true, elapsedMs: 0, anchorAt: null },
        },
        localRejected: [],
        needsFullReload: false,
      },
      log: [{ id: 'g1', type: 'GOAL' }],
      confirmedCount: 1,
    });
    act(() => {
      listeners.forEach((listener) => listener());
    });
    rerender();

    await waitFor(() => expect(result.current.tournament?.matches[0].scoreA).toBe(3));
    expect(result.current.tournament?.version).toBe(5);
    expect(mockUpdateTournament).not.toHaveBeenCalled();
  });

  it('I3 (Pflichttest W7): Overlay nach Server-Laden (applyRemote) erneut aktiv', async () => {
    mockLoadTournament.mockResolvedValue(makeTournament());
    const { result, rerender } = renderHook(() => useTournamentManager('tour-overlay'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    mockView.mockReturnValue({
      result: {
        state: {
          status: 'finished',
          phase: 'regular',
          scores: { teama: { regular: 4, overtime: 0, shootout: 0 }, teamb: { regular: 2, overtime: 0, shootout: 0 } },
          overrides: [],
          baseDecidedBy: 'regular',
          decidedBy: 'regular',
          finishedAt: 12345,
          clock: { running: false, elapsedMs: 0, anchorAt: null },
        },
        localRejected: [],
        needsFullReload: false,
      },
      log: [{ id: 'g1', type: 'GOAL' }],
      confirmedCount: 1,
    });
    act(() => {
      listeners.forEach((listener) => listener());
    });
    rerender();
    await waitFor(() => expect(result.current.tournament?.matches[0].scoreA).toBe(4));

    // Ein frisches Roh-Turnier vom Server (applyRemote, Task A1) -- die alten, unueberlagerten
    // Rohdaten (0:0, scheduled). Die Engine-Kopie selbst (mockView) ist unabhaengig davon weiterhin
    // vorhanden -- die Ueberlagerung muss sofort wieder greifen, statt bei der frischen Rohkopie
    // (0:0) stehen zu bleiben.
    act(() => {
      result.current.applyRemote(makeTournament());
    });
    rerender();

    await waitFor(() => expect(result.current.tournament?.matches[0].scoreA).toBe(4));
    expect(result.current.tournament?.matches[0].matchStatus).toBe('finished');
  });

  it('I3 (Review-Befund 4): handleTournamentUpdate uebernimmt Overlay-Werte fuer ein Engine-Spiel NICHT (Schreibpfad saeubert auf den rohen Stand)', async () => {
    mockLoadTournament.mockResolvedValue(makeTournament());
    const { result, rerender } = renderHook(() => useTournamentManager('tour-overlay'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    mockView.mockReturnValue({
      result: {
        state: {
          status: 'running',
          phase: 'regular',
          scores: { teama: { regular: 5, overtime: 0, shootout: 0 }, teamb: { regular: 1, overtime: 0, shootout: 0 } },
          overrides: [],
          baseDecidedBy: null,
          decidedBy: null,
          finishedAt: null,
          clock: { running: true, elapsedMs: 0, anchorAt: null },
        },
        localRejected: [],
        needsFullReload: false,
      },
      log: [{ id: 'g1', type: 'GOAL' }],
      confirmedCount: 1,
    });
    act(() => {
      listeners.forEach((listener) => listener());
    });
    rerender();
    await waitFor(() => expect(result.current.tournament?.matches[0].scoreA).toBe(5));

    // Ein Aufrufer (z. B. die Spielplan-Schnelleingabe fuer ein ANDERES Spiel) liest die
    // UEBERLAGERTE Ausgabe, aendert nur einen Referee-Wert und gibt das GANZE Objekt (inkl. der
    // Overlay-Werte fuer m1) an handleTournamentUpdate weiter.
    const overlaidSnapshot = result.current.tournament!;
    const callerUpdate: Tournament = { ...overlaidSnapshot, matches: [{ ...overlaidSnapshot.matches[0], referee: 7 }] };

    await act(async () => {
      await result.current.handleTournamentUpdate(callerUpdate);
    });

    expect(mockUpdateTournament).toHaveBeenCalledTimes(1);
    const persisted = mockUpdateTournament.mock.calls[0][0] as Tournament;
    // Das Referee-Feld (die eigentliche Absicht des Aufrufers) bleibt erhalten...
    expect(persisted.matches[0].referee).toBe(7);
    // ...aber die Engine-Ergebnis-/Statusfelder sind auf den ROHEN Stand (0:0/scheduled)
    // zurueckgesetzt, NICHT die Overlay-Werte (5:1/running).
    expect(persisted.matches[0].scoreA).toBe(0);
    expect(persisted.matches[0].scoreB).toBe(0);
    expect(persisted.matches[0].matchStatus).toBe('scheduled');
  });

  it('I3 Fixrunde 2 (Re-Review-Befund): applyRemote saeubert genauso -- ein Voll-Save NACH applyRemote persistiert Overlay-Werte NICHT', async () => {
    // Nachstellung der Reviewer-Probe: Overlay m1 = 2:1/running (Engine-Tor), dann eine
    // Schnelleingabe fuer ein ANDERES Spiel (m2) ueber applyRemote (liest die UEBERLAGERTE
    // Ausgabe, aendert nur m2, gibt das GANZE Objekt weiter), danach ein Voll-Save
    // (handleTournamentUpdate). Ohne Fix landete m1 = 2:1/running im Roh-State und damit in der
    // MutationQueue/beim Server.
    const t = makeTournament({
      matches: [
        ...makeTournament().matches,
        { id: 'm2', round: 1, field: 2, teamA: 'teamA', teamB: 'teamB', scoreA: 0, scoreB: 0, matchStatus: 'finished' },
      ],
    });
    mockLoadTournament.mockResolvedValue(t);
    const { result, rerender } = renderHook(() => useTournamentManager('tour-overlay'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    mockView.mockImplementation((matchId: string) => {
      if (matchId !== 'm1') {
        return null;
      }
      return {
        result: {
          state: {
            status: 'running',
            phase: 'regular',
            scores: { teama: { regular: 2, overtime: 0, shootout: 0 }, teamb: { regular: 1, overtime: 0, shootout: 0 } },
            overrides: [],
            baseDecidedBy: null,
            decidedBy: null,
            finishedAt: null,
            clock: { running: true, elapsedMs: 0, anchorAt: null },
          },
          localRejected: [],
          needsFullReload: false,
        },
        log: [{ id: 'g1', type: 'GOAL' }],
        confirmedCount: 1,
      };
    });
    act(() => {
      listeners.forEach((listener) => listener());
    });
    rerender();
    await waitFor(() => expect(result.current.tournament?.matches[0].scoreA).toBe(2));

    // Schnelleingabe fuer m2: liest die ueberlagerte Ausgabe (inkl. m1 = 2:1/running), aendert
    // NUR m2.scoreA, gibt das GANZE Objekt an applyRemote weiter (wie useScheduleTabActions.ts es
    // ueber onLocalTournamentUpdate tut).
    const overlaidSnapshot = result.current.tournament!;
    const quickEntryUpdate: Tournament = {
      ...overlaidSnapshot,
      matches: overlaidSnapshot.matches.map((m) => (m.id === 'm2' ? { ...m, scoreA: 9 } : m)),
    };
    act(() => {
      result.current.applyRemote(quickEntryUpdate);
    });

    // Ein anschliessender Voll-Save (z. B. Turniereinstellungen aendern) darf m1 NICHT mit den
    // Overlay-Werten (2:1/running) an die MutationQueue/den Server weitergeben.
    const fullSaveSnapshot = result.current.tournament!;
    await act(async () => {
      await result.current.handleTournamentUpdate({ ...fullSaveSnapshot, name: 'Neuer Name' } as Tournament);
    });

    expect(mockUpdateTournament).toHaveBeenCalledTimes(1);
    const persisted = mockUpdateTournament.mock.calls[0][0] as Tournament;
    const persistedM1 = persisted.matches.find((m) => m.id === 'm1')!;
    const persistedM2 = persisted.matches.find((m) => m.id === 'm2')!;
    expect(persistedM1.scoreA).toBe(0);
    expect(persistedM1.matchStatus).toBe('scheduled');
    // Die eigentliche Schnelleingabe (m2, ein Altspiel) bleibt erhalten.
    expect(persistedM2.scoreA).toBe(9);
  });
});
