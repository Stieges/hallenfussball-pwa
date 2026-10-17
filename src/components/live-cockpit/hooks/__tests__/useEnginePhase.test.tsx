/**
 * useEnginePhase (B-08a): liest `PhaseView` aus der echten Engine, taktet 250 ms nur bei laufender Uhr
 * oder in der Abschnittspause, `null` für Spiele ohne Engine-Kopie. Testwerte aus @FU-075 und GB5 B-08a.
 */
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchEngineContextValue } from '../../../../features/match-engine/matchEngineContextInstance';
import { MatchEngineContext } from '../../../../features/match-engine/matchEngineContextInstance';
import {
  REGEL_2X6,
  geraetBNeuLaden,
  spielAnlegen,
  zu,
  type EngineSpiel,
  type Geraet,
} from '../../__tests__/enginePhaseFixture';
import { useEnginePhase } from '../useEnginePhase';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  zu(0);
});

afterEach(() => {
  vi.useRealTimers();
});

function huelle(geraet: Geraet, accountId: string) {
  const value = { engine: geraet.engine, accountId } as unknown as MatchEngineContextValue;
  return function Huelle({ children }: { children: ReactNode }) {
    return <MatchEngineContext.Provider value={value}>{children}</MatchEngineContext.Provider>;
  };
}

describe('useEnginePhase (B-08a)', () => {
  it('liefert null ohne Engine-Provider (Altpfad ohne Engine)', () => {
    const { result } = renderHook(() => useEnginePhase('irgendein-spiel'));
    expect(result.current).toBeNull();
  });

  it('liefert null für ein Spiel ohne Engine-Kopie', async () => {
    const spiel = await spielAnlegen();
    const { result } = renderHook(() => useEnginePhase('kein-engine-spiel'), {
      wrapper: huelle(spiel.a, spiel.accountId),
    });
    expect(result.current).toBeNull();
  });

  it('taktet bei laufender Uhr alle 250 ms und hält bei Pause an', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    const { result } = renderHook(() => useEnginePhase(spiel.matchId), {
      wrapper: huelle(spiel.a, spiel.accountId),
    });
    expect(result.current?.sectionElapsedMs).toBe(0);
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current?.sectionElapsedMs).toBe(5_000);

    await act(async () => {
      await spiel.a.commands.pause(spiel.matchId, spiel.ctx, 'leitung');
    });
    expect(result.current?.status).toBe('paused');
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => {
      await spiel.a.commands.resume(spiel.matchId, spiel.ctx, 'leitung');
    });
    expect(result.current?.status).toBe('running');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('@SL-013 Pausen-Takt: in der Abschnittspause läuft die Restzeit herunter, nach 60 s bei 0', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(360_000);
    await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung');
    const { result, unmount } = renderHook(() => useEnginePhase(spiel.matchId), {
      wrapper: huelle(spiel.a, spiel.accountId),
    });
    expect(result.current?.breakRemainingMs).toBe(60_000);
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current?.breakRemainingMs).toBe(30_000);
    await act(async () => {
      vi.advanceTimersByTime(110_000);
    });
    expect(result.current?.breakRemainingMs).toBe(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('@FU-075 Gerät B neu geladen bei 6:00: Strafe Rest 1:00, Abschnitt 6:00', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(300_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(360_000);
    const b = await geraetBNeuLaden(spiel);
    const { result } = renderHook(() => useEnginePhase(spiel.matchId), {
      wrapper: huelle(b, spiel.accountId),
    });
    expect(result.current?.sectionElapsedMs).toBe(360_000);
    expect(result.current?.penalties).toEqual([expect.objectContaining({ teamId: 'teamb', remainingMs: 60_000 })]);
  });

  it('Gegenbeispiel: zurückgenommene Strafe erscheint auch im Hook nicht', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(300_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    const penaltyId = spiel.a.engine.view(spiel.matchId)?.log.find((event) => event.type === 'TIME_PENALTY')?.id ?? '';
    await spiel.a.commands.retract(spiel.matchId, spiel.ctx, 'leitung', penaltyId);
    zu(360_000);
    const { result } = renderHook(() => useEnginePhase(spiel.matchId), {
      wrapper: huelle(spiel.a, spiel.accountId),
    });
    expect(result.current?.penalties).toEqual([]);
  });

  it('@SL-097 beendetes Spiel zeigt keine laufende Strafe', async () => {
    const spiel: EngineSpiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(300_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(330_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    const { result } = renderHook(() => useEnginePhase(spiel.matchId), {
      wrapper: huelle(spiel.a, spiel.accountId),
    });
    expect(result.current?.status).toBe('finished');
    expect(result.current?.penalties).toEqual([]);
  });
});
