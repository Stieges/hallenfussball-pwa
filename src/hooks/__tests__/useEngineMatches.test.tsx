/**
 * useEngineMatches (C3a-1, Teil 1.3): Lesepfad-Test "Tor ohne Netz sichtbar" (C-OFFUI) + W4
 * (Platzhalter-Teams bekommen keine Kopie) + B1 (Spiel ohne Ereignisse bleibt Altspiel, C-OFFUI
 * nicht vorgezogen). Echte MatchEngine/LocalMatchStore (fake-indexeddb), nur der Provider-Kontext
 * ist gemockt.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { LocalMatchStore, MatchEngine, type ClockSync } from '../../core/match/client';
import type { Tournament, Match } from '../../types/tournament';

const store = new LocalMatchStore();
const mockContext: { engine: MatchEngine; clock: { offsetMs: number } } = {
  engine: new MatchEngine({
    store,
    clock: { serverNow: () => Date.now() } as unknown as ClockSync,
    sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn().mockResolvedValue({ events: [], newWatermark: 0 }),
    now: () => Date.now(),
    isOnline: () => false,
  }),
  clock: { offsetMs: 0 },
};
/** Fuer den "kein Provider"-Test auf `null` gesetzt -- Standard: der Kontext ist vorhanden. */
let activeContext: typeof mockContext | null = mockContext;
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => activeContext,
}));

import { useEngineMatches } from '../useEngineMatches';

function match(partial: Partial<Match> & Pick<Match, 'id' | 'teamA' | 'teamB'>): Match {
  return {
    round: 1,
    field: 1,
    matchNumber: 1,
    ...partial,
  };
}

function tournament(matches: Match[]): Tournament {
  return {
    id: 'tour-engine-matches',
    teams: [
      { id: 'teamA', name: 'Heim' },
      { id: 'teamB', name: 'Gast' },
    ],
    matches,
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

describe('useEngineMatches', () => {
  beforeEach(async () => {
    activeContext = mockContext;
    await mockContext.engine.start('acc-engine-matches');
  });

  it('ohne MatchEngineProvider (Provider noch nicht im App-Baum): leere Map statt Absturz', () => {
    activeContext = null;
    const t = tournament([match({ id: 'm-no-provider', teamA: 'teamA', teamB: 'teamB' })]);
    const { result } = renderHook(() => useEngineMatches(t, false));

    expect(result.current.liveMatches.size).toBe(0);
    expect(result.current.isEngineMatch('m-no-provider')).toBe(false);
  });

  it('W4: Platzhalter-Team ("TBD") bekommt keine Kopie und ist kein Engine-Spiel', async () => {
    const t = tournament([match({ id: 'm-placeholder', teamA: 'teamA', teamB: 'TBD' })]);
    const { result } = renderHook(() => useEngineMatches(t, false));

    await waitFor(() => {
      const copy = mockContext.engine.view('m-placeholder');
      expect(copy).toBeNull();
    });
    expect(result.current.isEngineMatch('m-placeholder')).toBe(false);
  });

  it('B1 (C3a-1): ein Spiel ohne jedes Ereignis bleibt Altspiel (kein Eintrag in liveMatches)', async () => {
    const t = tournament([match({ id: 'm-old', teamA: 'teamA', teamB: 'teamB' })]);
    const { result } = renderHook(() => useEngineMatches(t, false));

    await waitFor(() => {
      expect(mockContext.engine.view('m-old')).not.toBeNull();
    });
    expect(result.current.isEngineMatch('m-old')).toBe(false);
    expect(result.current.liveMatches.has('m-old')).toBe(false);
  });

  it('C-OFFUI: Tor ohne Netz sichtbar -- Kopie mit pending-GOAL zeigt das Tor ohne Server-Aufruf', async () => {
    const t = tournament([match({ id: 'm-offline-goal', teamA: 'teamA', teamB: 'teamB' })]);
    const { result, rerender } = renderHook(() => useEngineMatches(t, false));

    await waitFor(() => expect(mockContext.engine.view('m-offline-goal')).not.toBeNull());

    // MATCH_START confirmed, damit das Tor ueberhaupt angewendet wird (sonst INVALID_TRANSITION) --
    // wie es MatchCommands (C3a-2a) spaeter tun wird, hier direkt im Store nachgestellt.
    await store.applyConfirmed(
      'acc-engine-matches',
      'm-offline-goal',
      [{ id: 'start-1', type: 'MATCH_START', at: 0, actor: 'leitung', section: 1, clockMs: 0, payload: {
        rules: { sections: 2, sectionSeconds: 600, breakSeconds: 60, knockout: false, tiebreak: null, overtimeSeconds: 0, shootersPerTeam: 5, suddenDeathAfter: 5, penaltySeconds: 120 },
      }, seq: 1 }],
      1,
    );
    // Ein pending-GOAL landet -- ohne jeden Server-Aufruf -- direkt im Store.
    await store.addPending('acc-engine-matches', 'm-offline-goal', {
      id: 'goal-1',
      type: 'GOAL',
      at: 1000,
      actor: 'leitung',
      section: 1,
      clockMs: 500,
      teamId: 'teama',
      payload: {},
    });
    // Die Engine cacht die Kopie im Speicher -- ausserhalb der Engine geschriebene Aenderungen
    // (hier: der Store direkt, wie es MatchCommands spaeter ueber addPending tut) werden erst nach
    // einem erneuten ensureMatch (Kopie neu lesen) sichtbar.
    await mockContext.engine.ensureMatch(
      'm-offline-goal',
      { matchId: 'm-offline-goal', teamAId: 'teama', teamBId: 'teamb' },
      'tour-engine-matches',
    );

    rerender();

    await waitFor(() => expect(result.current.isEngineMatch('m-offline-goal')).toBe(true));
    const live = result.current.liveMatches.get('m-offline-goal');
    expect(live?.homeScore).toBe(1);
    expect(live?.events).toHaveLength(1);
    expect(live?.events[0].type).toBe('GOAL');
  });
});
