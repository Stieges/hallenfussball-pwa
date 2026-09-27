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
import { serverRules } from '../../core/match';
import type { Tournament, Match } from '../../types/tournament';

const store = new LocalMatchStore();
const mockFetchConfirmed = vi.fn().mockResolvedValue({ events: [], newWatermark: 0 });
const mockContext: { engine: MatchEngine; clock: { offsetMs: number } } = {
  engine: new MatchEngine({
    store,
    clock: { serverNow: () => Date.now() } as unknown as ClockSync,
    sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: mockFetchConfirmed,
    now: () => Date.now(),
  }),
  clock: { offsetMs: 0 },
};
/** Fuer den "kein Provider"-Test auf `null` gesetzt -- Standard: der Kontext ist vorhanden. */
let activeContext: typeof mockContext | null = mockContext;
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => activeContext,
}));

// M9 (Server-Erkennung): `fetchEngineMatchIds` selbst ist bereits eigenstaendig getestet
// (fetchEngineMatchIds.test.ts) -- hier geht es nur um die Verdrahtung (Ergebnis -> engineMatchIds
// -> isEngineMatch, ganz OHNE lokale Ereignisse).
const mockFetchEngineMatchIds = vi.fn().mockResolvedValue(new Set<string>());
vi.mock('../../features/match-engine/fetchEngineMatchIds', () => ({
  fetchEngineMatchIds: (...args: unknown[]) => mockFetchEngineMatchIds(...args),
}));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));

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
    mockFetchEngineMatchIds.mockReset().mockResolvedValue(new Set<string>());
    mockFetchConfirmed.mockClear().mockResolvedValue({ events: [], newWatermark: 0 });
    await mockContext.engine.start('acc-engine-matches');
  });

  it('N-I3: die Sammelabfrage meldet Spiel X -- markEngineMatches/catchUpLoaded laden NUR X nach, andere Spiele nicht', async () => {
    mockFetchEngineMatchIds.mockResolvedValue(new Set(['m-known']));
    const t = tournament([
      match({ id: 'm-known', teamA: 'teamA', teamB: 'teamB' }),
      match({ id: 'm-other', teamA: 'teamA', teamB: 'teamB' }),
    ]);
    renderHook(() => useEngineMatches(t, true));

    await waitFor(() => expect(mockFetchConfirmed).toHaveBeenCalledWith('m-known', 0));
    expect(mockFetchConfirmed).not.toHaveBeenCalledWith('m-other', 0);
    expect(mockFetchConfirmed).toHaveBeenCalledTimes(1);
  });

  it('N-m5: scheitert die Sammelabfrage, bleibt das letzte gute Ergebnis erhalten (kein Rueckfall auf leer)', async () => {
    mockFetchEngineMatchIds.mockResolvedValueOnce(new Set(['m-good']));
    const firstTournament = tournament([match({ id: 'm-good', teamA: 'teamA', teamB: 'teamB' })]);
    const { result, rerender } = renderHook(
      ({ t }) => useEngineMatches(t, true),
      { initialProps: { t: firstTournament } },
    );
    await waitFor(() => expect(result.current.isEngineMatch('m-good')).toBe(true));

    // Neues Turnier-Objekt (loest den Sammelabfrage-Effekt erneut aus), diesmal SCHEITERT die Abfrage.
    mockFetchEngineMatchIds.mockReset().mockRejectedValue(new Error('Netz weg'));
    const secondTournament: Tournament = { ...firstTournament, id: 'tour-engine-matches-2' };
    rerender({ t: secondTournament });

    await waitFor(() => expect(mockFetchEngineMatchIds).toHaveBeenCalled());
    // Trotz gescheiterter Sammelabfrage bleibt 'm-good' ein bekanntes Engine-Spiel.
    expect(result.current.isEngineMatch('m-good')).toBe(true);
  });

  it('M9: ein Spiel OHNE lokale Ereignisse wird ueber die Sammelabfrage als Engine-Spiel erkannt', async () => {
    mockFetchEngineMatchIds.mockResolvedValue(new Set(['m-server-only']));
    const t = tournament([match({ id: 'm-server-only', teamA: 'teamA', teamB: 'teamB' })]);
    const { result, rerender } = renderHook(() => useEngineMatches(t, true));

    await waitFor(() => expect(mockFetchEngineMatchIds).toHaveBeenCalled());
    rerender();

    await waitFor(() => expect(result.current.isEngineMatch('m-server-only')).toBe(true));
    expect(mockContext.engine.view('m-server-only')?.log).toHaveLength(0); // keine lokalen Ereignisse
  });

  it('W5: Teamfarben/-logo werden aus tournament.teams nachgetragen (Adapter kennt nur id/name)', async () => {
    mockFetchEngineMatchIds.mockResolvedValue(new Set(['m-visuals']));
    const t = {
      id: 'tour-visuals',
      teams: [
        { id: 'teamA', name: 'Heim', logo: { url: 'https://example.test/a.png' }, colors: { primary: '#111111' } },
        { id: 'teamB', name: 'Gast', logo: { url: 'https://example.test/b.png' }, colors: { primary: '#222222' } },
      ],
      matches: [match({ id: 'm-visuals', teamA: 'teamA', teamB: 'teamB' })],
      groupPhaseGameDuration: 20,
    } as unknown as Tournament;

    const { result, rerender } = renderHook(() => useEngineMatches(t, true));
    await waitFor(() => expect(mockFetchEngineMatchIds).toHaveBeenCalled());
    rerender();
    await waitFor(() => expect(result.current.isEngineMatch('m-visuals')).toBe(true));

    const live = result.current.liveMatches.get('m-visuals');
    expect(live?.homeTeam.logo).toEqual({ url: 'https://example.test/a.png' });
    expect(live?.homeTeam.colors).toEqual({ primary: '#111111' });
    expect(live?.awayTeam.logo).toEqual({ url: 'https://example.test/b.png' });
    expect(live?.awayTeam.colors).toEqual({ primary: '#222222' });
  });

  it('I6/K3/W5: vor dem Anpfiff rechnet die Dauer mit der PHASE des Spiels (Finalrunde != Gruppendauer)', async () => {
    mockFetchEngineMatchIds.mockResolvedValue(new Set(['m-final']));
    const t = {
      id: 'tour-final-phase',
      teams: [{ id: 'teamA', name: 'Heim' }, { id: 'teamB', name: 'Gast' }],
      matches: [match({ id: 'm-final', teamA: 'teamA', teamB: 'teamB', phase: 'final' })],
      groupPhaseGameDuration: 20,
      finalRoundGameDuration: 10,
    } as unknown as Tournament;
    const finalRules = serverRules({
      durationMinutes: null,
      phase: 'final',
      groupPhaseDuration: 20,
      finalRoundDuration: 10,
      config: {},
      finalsConfig: null,
    });
    const expectedDurationSeconds = finalRules.sections * finalRules.sectionSeconds;

    const { result, rerender } = renderHook(() => useEngineMatches(t, true));
    await waitFor(() => expect(mockFetchEngineMatchIds).toHaveBeenCalled());
    rerender();
    await waitFor(() => expect(result.current.isEngineMatch('m-final')).toBe(true));

    const groupRules = serverRules({
      durationMinutes: null,
      phase: null, // 'null' zaehlt laut serverRules als Gruppenphase
      groupPhaseDuration: 20,
      finalRoundDuration: 10,
      config: {},
      finalsConfig: null,
    });
    const groupDurationSeconds = groupRules.sections * groupRules.sectionSeconds;

    const live = result.current.liveMatches.get('m-final');
    expect(live?.durationSeconds).toBeGreaterThan(0);
    expect(live?.durationSeconds).toBe(expectedDurationSeconds);
    // Regressionsschutz gegen "Phase wird ignoriert, Gruppendauer gilt immer" (M3): mit 20 statt
    // 10 Minuten waere der Wert ein anderer.
    expect(live?.durationSeconds).not.toBe(groupDurationSeconds);
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
    // Ein pending-GOAL landet -- ohne jeden Server-Aufruf -- direkt im Store. Mit `playerNumber`,
    // damit B2 (Log-Aufbau) end-to-end (Store -> MatchEngine.view -> toLiveMatchView) auch
    // Torschuetze und `scoreAfter` bewiesen liefert, nicht nur den nackten Ereignistyp.
    await store.addPending('acc-engine-matches', 'm-offline-goal', {
      id: 'goal-1',
      type: 'GOAL',
      at: 1000,
      actor: 'leitung',
      section: 1,
      clockMs: 500,
      teamId: 'teama',
      payload: { playerNumber: 9 },
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
    expect(live?.events[0].payload.playerNumber).toBe(9);
    expect(live?.events[0].scoreAfter).toEqual({ home: 1, away: 0 });
  });
});
