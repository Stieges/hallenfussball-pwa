/**
 * useEnginePhase (B-08a): liest `PhaseView` aus der echten Engine, taktet 250 ms nur bei laufender Uhr
 * oder in der Abschnittspause, `null` für Spiele ohne Engine-Kopie, meldet sich beim Unmount ab und
 * folgt einem Wechsel der matchId. Testwerte wörtlich aus @SL-013, @FU-075, @SL-097 (GB5 B-08a).
 */
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchEngineContextValue } from '../../../../features/match-engine/matchEngineContextInstance';
import { MatchEngineContext } from '../../../../features/match-engine/matchEngineContextInstance';
import {
  REGEL_2X6,
  REGEL_2X10,
  geraetBNeuLaden,
  spielAnlegen,
  zu,
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

  it('Pausen-Takt: in der Abschnittspause läuft die Restzeit herunter, nach 60 s bei 0', async () => {
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

  it('@SL-097 Abpfiff bei 6:00 im zweiten Abschnitt: keine laufende Strafe mehr', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(600_000);
    await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(660_000);
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(960_000); // 5:00 im zweiten Abschnitt
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(1_020_000); // 6:00 im zweiten Abschnitt
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    const { result } = renderHook(() => useEnginePhase(spiel.matchId), {
      wrapper: huelle(spiel.a, spiel.accountId),
    });
    expect(result.current?.status).toBe('finished');
    expect(result.current?.penalties).toEqual([]);
  });

  it('@SL-013 (a) Gerät gesperrt: 90 s ohne Takt, nach dem Entsperren 3:30 und Restzeit 0:30', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(120_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    const { result } = renderHook(() => useEnginePhase(spiel.matchId), {
      wrapper: huelle(spiel.a, spiel.accountId),
    });
    zu(210_000); // gesperrt: Zeit vergeht, nichts rendert
    await act(async () => {
      await spiel.a.engine.notifyStoreChange(spiel.matchId); // Entsperren rendert neu
    });
    expect(result.current?.sectionElapsedMs).toBe(210_000);
    expect(result.current?.penalties[0]?.remainingMs).toBe(30_000);
  });

  it('B2 Wechsel der matchId: zeigt das neue Spiel, Takt bleibt einer, Abpfiff des alten ändert nichts', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    const { result, rerender } = renderHook(({ id }: { id: string }) => useEnginePhase(id), {
      initialProps: { id: spiel.matchId },
      wrapper: huelle(spiel.a, spiel.accountId),
    });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current?.sectionElapsedMs).toBe(5_000);

    // Zweites Spiel startet bei 5:00 der Wanduhr, also mit Spielzeit 0.
    const zweiterId = `${spiel.matchId}-zwei`;
    const ctxZwei = { matchId: zweiterId, teamAId: 'teamc', teamBId: 'teamd' };
    await spiel.a.engine.ensureMatch(zweiterId, ctxZwei);
    await spiel.a.commands.start(zweiterId, ctxZwei, 'leitung', REGEL_2X6);
    rerender({ id: zweiterId });
    expect(result.current?.sectionElapsedMs).toBe(0);
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    });
    expect(result.current?.status).toBe('running');
    expect(result.current?.sectionElapsedMs).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('B2 Abmelden: der Unmount löst das Abo und den Takt', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    const echtesAbo = spiel.a.engine.subscribe.bind(spiel.a.engine);
    let abgemeldet = 0;
    vi.spyOn(spiel.a.engine, 'subscribe').mockImplementation((listener: () => void) => {
      const abmelden = echtesAbo(listener);
      return () => {
        abgemeldet += 1;
        abmelden();
      };
    });
    const { unmount } = renderHook(() => useEnginePhase(spiel.matchId), {
      wrapper: huelle(spiel.a, spiel.accountId),
    });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(abgemeldet).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
