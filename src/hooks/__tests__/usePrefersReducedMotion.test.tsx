/**
 * usePrefersReducedMotion (Plan LT-3, K12, @SL-156): „Bewegung reduzieren“ des Geräts, mit Abo auf Änderungen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';

type Hoerer = (e: { matches: boolean }) => void;

function stubMatchMedia(startwert: boolean) {
  const hoerer = new Set<Hoerer>();
  const aufruf = { query: '' };
  const mql = {
    get matches() { return startwert; },
    addEventListener: (_t: string, h: Hoerer) => { hoerer.add(h); },
    removeEventListener: (_t: string, h: Hoerer) => { hoerer.delete(h); },
  };
  vi.stubGlobal('matchMedia', (q: string) => { aufruf.query = q; return mql; });
  return { hoerer, aufruf, setze: (w: boolean) => { startwert = w; hoerer.forEach((h) => { h({ matches: w }); }); } };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('usePrefersReducedMotion', () => {
  it('@SL-156 „Bewegung reduzieren“ eingestellt → true, gefragt wird nach prefers-reduced-motion: reduce', () => {
    const m = stubMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
    expect(m.aufruf.query).toBe('(prefers-reduced-motion: reduce)');
  });

  it('Gegenbeispiel: ohne die Einstellung → false', () => {
    stubMatchMedia(false);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });

  it('folgt einer Änderung der Einstellung während das Cockpit offen ist und räumt das Abo beim Aushängen auf', () => {
    const m = stubMatchMedia(false);
    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    act(() => { m.setze(true); });
    expect(result.current).toBe(true);
    unmount();
    expect(m.hoerer.size).toBe(0);
  });

  it('ohne matchMedia (alte Umgebung) → false, kein Fehler', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });
});
