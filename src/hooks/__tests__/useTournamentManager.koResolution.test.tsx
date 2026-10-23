/**
 * A-08f3e2 Fixrunde 1 (I-1): `useTournamentManager` besetzt die K.-o.-Plätze nach der Server-Bestätigung eines
 * Spielplan-Eintrags selbst -- ohne gemounteten Spielplan-Tab. Lokaler Stand und `updateMatches` (nur Slots).
 * Echter Store/Engine/Sender, TournamentService gemockt. Szenario: @FU-080 (Folgespiele).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const kv = vi.hoisted(() => new Map<string, string>());
const service = vi.hoisted(() => ({ load: vi.fn(), updateMatches: vi.fn(async () => undefined) }));
vi.mock('../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: (key: string) => kv.get(key) ?? null,
    setItem: (key: string, value: string) => { kv.set(key, value); },
    removeItem: (key: string) => { kv.delete(key); },
    getIsAvailable: () => true,
  },
}));
vi.mock('../../core/services/TournamentService', () => {
  class MockTournamentService {
    loadTournament = service.load;
    updateTournament = vi.fn();
    schedule = { updateMatches: service.updateMatches };
  }
  return { TournamentService: MockTournamentService };
});
const REPOS = { tournamentRepository: {}, isRealtimeEnabled: false };
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => REPOS }));
vi.mock('../useRealtimeTournament', () => ({ useRealtimeTournament: () => ({ isConnected: false, status: 'disconnected' }) }));

import { MatchCommands } from '../../core/match/client';
import { MatchEngineContext } from '../../features/match-engine/matchEngineContextInstance';
import { enqueueKo } from '../koResolutionQueue';
import { useTournamentManager } from '../useTournamentManager';
import { FC_NORD, FINALE, GAST, HALBFINALE_1, HEIM, HF1_ID, SPIEL_7, SPIEL_9, SV_SUED, finaleAusGruppeA, finaleAusHalbfinale1, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine } from '../../test/scheduleEngineHarness';

const CTX_9 = { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD };
const CTX_HF1 = { matchId: HF1_ID, teamAId: HEIM, teamBId: GAST };

describe('useTournamentManager: K.-o.-Auflösung nach Bestätigung (I-1)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    kv.clear();
    service.updateMatches.mockClear();
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('GA4 A-13c: Herkunft aus einem Spiel – Halbfinale 1 bestätigt → Finale besetzt (lokal und per updateMatches, nur Slots), ohne Spielplan-Tab', async () => {
    service.load.mockResolvedValue(scheduleTournament({ [HALBFINALE_1]: { id: HF1_ID } }, [finaleAusHalbfinale1()]));
    const wrapper = ({ children }: { children: ReactNode }) => createElement(MatchEngineContext.Provider, { value: h.value }, children);
    const { result } = renderHook(() => useTournamentManager('T'), { wrapper });
    await act(async () => { await settle(); });

    await act(async () => {
      await h.engine.ensureMatch(HF1_ID, CTX_HF1, 'T');
      const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
      const eventId = await commands.enterResult(HF1_ID, CTX_HF1, 'leitung', { [HEIM]: 3, [GAST]: 1 }, undefined, false);
      if (eventId) { enqueueKo(h.value.accountId, 'T', { eventId, matchId: HF1_ID }); }
      await settle();
    });

    expect(service.updateMatches).toHaveBeenCalledTimes(1);
    const [tournamentId, updates] = service.updateMatches.mock.calls[0] as unknown as [string, Array<Record<string, unknown>>];
    expect(tournamentId).toBe('T');
    expect(updates.map((update) => Object.keys(update).sort())).toEqual([['id', 'slotA', 'slotB']]);
    expect(result.current.tournament?.matches.find((m) => m.id === FINALE)?.slotA).toMatchObject({ kind: 'team' });
  });

  it('@TM-044 Gegenbeispiel: das letzte Gruppenspiel bestätigt → keine Slot-Updates, das Finale zeigt weiter „Erster/Zweiter Gruppe A“', async () => {
    service.load.mockResolvedValue(scheduleTournament({ [SPIEL_7]: { scoreA: 1, scoreB: 0, matchStatus: 'finished' } }, [finaleAusGruppeA()]));
    const wrapper = ({ children }: { children: ReactNode }) => createElement(MatchEngineContext.Provider, { value: h.value }, children);
    const { result } = renderHook(() => useTournamentManager('T'), { wrapper });
    await act(async () => { await settle(); });

    await act(async () => {
      await h.engine.ensureMatch(SPIEL_9, CTX_9, 'T');
      const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
      const eventId = await commands.enterResult(SPIEL_9, CTX_9, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 1 }, undefined, false);
      if (eventId) { enqueueKo(h.value.accountId, 'T', { eventId, matchId: SPIEL_9 }); }
      await settle();
    });

    expect(service.updateMatches).not.toHaveBeenCalled();
    expect(result.current.tournament?.matches.find((m) => m.id === FINALE)?.slotA.kind).toBe('pending');
  });
});
