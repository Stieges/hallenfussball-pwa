/**
 * B-15 Review A1: Adapter (a) ruft ohne festen Takt ab – beim Öffnen, bei Rückkehr in den Vordergrund, bei Netz und auf Wunsch;
 * der 10-s-Takt gilt erst für Adapter (b) (BP-2). Gegenbeispiel zu @ZM-021 für den heutigen Weg. Fake-Timer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';
import { usePublicTournament } from '../usePublicTournament';
import { createLegacyPublicSource } from '../legacyPublicSource';
import { createRpcPublicSource } from '../rpcPublicSource';
import { fullReply, unchangedReply } from './payloadFixtures';

async function advance(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Adapter (a) ohne festen Takt', () => {
  const setup = () => {
    const lookup = { getByShareCode: vi.fn().mockImplementation(() => Promise.resolve(buildLiveViewTournament())) };
    const source = createLegacyPublicSource(lookup, { clock: { nowMs: () => Date.now() } });
    const hook = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    return { lookup, ...hook };
  };

  it('@ZM-021 Gegenbeispiel: in 60 Sekunden im Vordergrund genau 1 Abruf (beim Öffnen), nicht 7', async () => {
    const { lookup } = setup();
    await advance(60_000);
    expect(lookup.getByShareCode).toHaveBeenCalledTimes(1);
  });

  it('@ZM-030 Rückkehr in den Vordergrund ruft einmal ab; im Hintergrund nie', async () => {
    const { lookup } = setup();
    await advance(0);
    setVisibility('hidden');
    await advance(5 * 60_000);
    expect(lookup.getByShareCode).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    await advance(0);
    expect(lookup.getByShareCode).toHaveBeenCalledTimes(2);
    await advance(60_000);
    expect(lookup.getByShareCode).toHaveBeenCalledTimes(2);
  });

  it('@ZM-037 Netz zurück und Herunterziehen rufen je einmal ab', async () => {
    const { lookup, result } = setup();
    await advance(0);
    await act(async () => { window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0); });
    expect(lookup.getByShareCode).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.refresh(); });
    expect(lookup.getByShareCode).toHaveBeenCalledTimes(3);
  });
});

describe('Entwicklungsmodus (StrictMode)', () => {
  it('der erste Abruf gilt auch nach dem Neu-Einhängen der Seite: ohne Takt steht der Stand trotzdem da', async () => {
    const lookup = { getByShareCode: vi.fn().mockImplementation(() => Promise.resolve(buildLiveViewTournament())) };
    const source = createLegacyPublicSource(lookup, { clock: { nowMs: () => Date.now() } });
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }), { wrapper: StrictMode });
    await advance(0);
    expect(result.current.loadingState).toBe('success');
  });
});

describe('Adapter (b) mit 10-s-Takt', () => {
  it('@ZM-021 in 60 Sekunden höchstens 7 Abrufe (sofort + 6 Takte), davon 6 nach der ersten Sekunde', async () => {
    const call = vi.fn().mockImplementation((args: { since_version: number | null }) =>
      Promise.resolve({ data: args.since_version === null ? fullReply() : unchangedReply(args.since_version), error: null }));
    const source = createRpcPublicSource({ call });
    renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null }));
    await advance(60_000);
    expect(call).toHaveBeenCalledTimes(7);
  });
});
