/**
 * H4-9 Folgepunkt k7 (Review H4-8): Kopfzeile, Streifen und Seite fragen nicht mehr je eigenständig alle 3 s `navigator.locks.query`,
 * sondern teilen EINE Abfrage je Fenster. Das Verhalten bleibt wie in `anderesFenster.test.tsx` (@HT-033 Zeile 8).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LokaleLage } from '../hallAnzeige';
import { ABFRAGE_MS, useAnderesFensterTont } from '../useAnderesFensterTont';

const wartet: LokaleLage = { felder: [1], rolle: 'wartet', zustandJeFeld: { 'field-1': 'not_activated' } };
const tont: LokaleLage = { felder: [1], rolle: 'toent', zustandJeFeld: { 'field-1': 'ready' } };

let held: string[];
let query: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  held = ['hallenton'];
  query = vi.fn(() => Promise.resolve({ held: held.map((name) => ({ name })) }));
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { query } });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'locks');
});

describe('k7 eine gemeinsame Abfrage je Fenster', () => {
  it('drei Stellen (Kopfzeile, Streifen, Seite) fragen sofort nur einmal und danach alle 3 s nur einmal', async () => {
    const stellen = [1, 2, 3].map(() => renderHook(() => useAnderesFensterTont(wartet)));
    await act(async () => { await Promise.resolve(); });
    expect(query).toHaveBeenCalledTimes(1);
    for (const s of stellen) {
      expect(s.result.current).toBe(true);
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(ABFRAGE_MS + 10); });
    expect(query).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(ABFRAGE_MS); });
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('eine Stelle, die später dazukommt, sieht den Stand sofort und startet keine zweite Abfrage', async () => {
    const erste = renderHook(() => useAnderesFensterTont(wartet));
    await act(async () => { await Promise.resolve(); });
    expect(erste.result.current).toBe(true);
    const zweite = renderHook(() => useAnderesFensterTont(wartet));
    expect(zweite.result.current).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('geht die letzte Stelle, hört die Abfrage auf; kommt eine neue, fragt sie wieder sofort', async () => {
    const eine = renderHook(() => useAnderesFensterTont(wartet));
    await act(async () => { await Promise.resolve(); });
    eine.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(ABFRAGE_MS * 3); });
    expect(query).toHaveBeenCalledTimes(1);
    const neue = renderHook(() => useAnderesFensterTont(wartet));
    await act(async () => { await Promise.resolve(); });
    expect(query).toHaveBeenCalledTimes(2);
    expect(neue.result.current).toBe(true);
  });
  it('schließt das andere Fenster, springen alle Stellen nach der nächsten Abfrage zurück', async () => {
    const stellen = [1, 2].map(() => renderHook(() => useAnderesFensterTont(wartet)));
    await act(async () => { await Promise.resolve(); });
    held = [];
    await act(async () => { await vi.advanceTimersByTimeAsync(ABFRAGE_MS + 10); });
    for (const s of stellen) {
      expect(s.result.current).toBe(false);
    }
  });
  it('Gegenbeispiel: eine Stelle, die selbst tönt, fragt nicht und zeigt nie „anderes Fenster“, auch wenn eine andere Stelle fragt', async () => {
    const fragend = renderHook(() => useAnderesFensterTont(wartet));
    const toenend = renderHook(() => useAnderesFensterTont(tont));
    await act(async () => { await Promise.resolve(); });
    expect(fragend.result.current).toBe(true);
    expect(toenend.result.current).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
