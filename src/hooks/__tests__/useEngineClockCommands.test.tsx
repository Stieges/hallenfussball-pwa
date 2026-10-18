/**
 * useEngineClockCommands (B-08b): startSection, endSection, adjustClock und finish(timing) über MatchCommands.
 * Testwerte aus @SL-006 (Wiederanpfiff startet den zweiten Abschnitt), @SL-005 (Abschnittsende), @FU-070.
 * Echte Engine und echter Store (fake-indexeddb); gemockt nur die Rolle.
 */
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStoreFullError } from '../../core/match/client';
import type { MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';
import { MatchEngineContext } from '../../features/match-engine/matchEngineContextInstance';
import { REGEL_2X6, T0, spielAnlegen, zu, type EngineSpiel } from '../../components/live-cockpit/__tests__/enginePhaseFixture';
import { useEngineClockCommands } from '../useEngineClockCommands';

vi.mock('../useActorRole', () => ({ useActorRole: () => 'leitung' }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
});
afterEach(() => {
  vi.useRealTimers();
});

function huelle(spiel: EngineSpiel) {
  const value = {
    engine: spiel.a.engine, store: spiel.store, sender: { kick: vi.fn().mockResolvedValue(undefined) }, accountId: spiel.accountId,
  } as unknown as MatchEngineContextValue;
  return function Huelle({ children }: { children: ReactNode }) {
    return <MatchEngineContext.Provider value={value}>{children}</MatchEngineContext.Provider>;
  };
}

function befehle(spiel: EngineSpiel, onError = vi.fn()) {
  const match = { id: spiel.matchId, homeTeam: { id: 'teama' }, awayTeam: { id: 'teamb' } };
  const rendered = renderHook(() => useEngineClockCommands({ tournamentId: 'tour-1', match, onError }), { wrapper: huelle(spiel) });
  return { ...rendered, onError };
}

function log(spiel: EngineSpiel, type: string) {
  return (spiel.a.engine.view(spiel.matchId)?.log ?? []).filter((event) => event.type === type);
}

async function bisPause(spiel: EngineSpiel): Promise<void> {
  await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
  zu(360_000);
  await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung', { clockMs: 360_000, at: T0 + 360_000 });
  zu(420_000);
}

describe('useEngineClockCommands', () => {
  it('@SL-006 startSection im Wiederanpfiff: SECTION_START, zweiter Abschnitt läuft ab 0:00', async () => {
    const spiel = await spielAnlegen();
    await bisPause(spiel);
    const { result, onError } = befehle(spiel);
    let id: string | null = null;
    await act(async () => { id = await result.current.startSection(); });
    expect(id).not.toBeNull();
    expect(log(spiel, 'SECTION_START')).toHaveLength(1);
    expect(spiel.a.engine.view(spiel.matchId)?.result.state.status).toBe('running');
    expect(spiel.a.engine.view(spiel.matchId)?.result.state.section).toBe(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it('@SL-005 endSection mit Grenze: SECTION_END trägt Spielzeit, Zeitpunkt und feste ID wörtlich', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(361_500);
    const { result } = befehle(spiel);
    const fest = '5b1c0c3e-8a64-5a6d-8a53-0a9f6f0d1e11';
    await act(async () => { await result.current.endSection({ clockMs: 360_000, at: T0 + 360_000, id: fest }, { silent: true }); });
    expect(log(spiel, 'SECTION_END')).toMatchObject([{ id: fest, clockMs: 360_000, at: T0 + 360_000 }]);
  });

  it('@FU-070 finish(timing) beendet im letzten Abschnitt mit MATCH_END an der Grenze', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', { ...REGEL_2X6, sections: 1 });
    zu(361_000);
    const { result } = befehle(spiel);
    await act(async () => { await result.current.finish({ clockMs: 360_000, at: T0 + 360_000 }, { silent: true }); });
    expect(log(spiel, 'MATCH_END')).toMatchObject([{ clockMs: 360_000 }]);
    expect(spiel.a.engine.view(spiel.matchId)?.result.state.status).toBe('finished');
  });

  it('adjustClock sendet CLOCK_ADJUST mit der neuen und der vorigen Spielzeit', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(320_000);
    const { result } = befehle(spiel);
    await act(async () => { await result.current.adjustClock(290_000, 320_000); });
    expect(log(spiel, 'CLOCK_ADJUST')).toMatchObject([{ clockMs: 290_000, payload: { previousClockMs: 320_000 } }]);
  });

  it('Gegenbeispiel: ein Wiederanpfiff im laufenden Abschnitt wird abgelehnt und gemeldet, nichts gespeichert', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(10_000);
    const { result, onError } = befehle(spiel);
    let id: string | null = 'x';
    await act(async () => { id = await result.current.startSection(); });
    expect(id).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('cockpit:engine.invalid');
    expect(log(spiel, 'SECTION_START')).toHaveLength(0);
  });

  it('Gegenbeispiel: still meldet eine Ablehnung nicht', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(10_000);
    const { result, onError } = befehle(spiel);
    await act(async () => { await result.current.endSection({ clockMs: 5, at: T0 + 5 }, { silent: true }); });
    // 1. Abschnitt endet vorzeitig: gültig. Danach ist das zweite Ende im Wiederanpfiff ungültig und bleibt still.
    await act(async () => { await result.current.endSection({ clockMs: 5, at: T0 + 5 }, { silent: true }); });
    expect(onError).not.toHaveBeenCalled();
    expect(log(spiel, 'SECTION_END')).toHaveLength(1);
  });

  it('Speicher voll wird auch im stillen Weg gemeldet', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(10_000);
    vi.spyOn(spiel.store, 'addPending').mockRejectedValue(new LocalStoreFullError());
    const { result, onError } = befehle(spiel);
    await act(async () => { await result.current.endSection({ clockMs: 5, at: T0 + 5 }, { silent: true }); });
    expect(onError).toHaveBeenCalledWith('cockpit:engine.storeFull');
  });

  it('ohne Engine-Provider: Hinweis statt Ausfall, kein Wurf', async () => {
    const onError = vi.fn();
    const match = { id: 'kein-spiel', homeTeam: { id: 'a' }, awayTeam: { id: 'b' } };
    const { result } = renderHook(() => useEngineClockCommands({ tournamentId: 'tour-1', match, onError }));
    let id: string | null = 'x';
    await act(async () => { id = await result.current.startSection(); });
    expect(id).toBeNull();
    expect(onError).toHaveBeenCalledWith('cockpit:engine.invalid');
  });
});
