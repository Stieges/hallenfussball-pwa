/** useFeinerZeiger (Aufgabe 3.4, Auflage 8): Tastatur-Modus des Nummern-Bausteins nie nach Breite, sondern nach `(hover: hover) and (pointer: fine)`. @SL-153 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeinerZeiger } from '../useFeinerZeiger';

type Listener = (e: { matches: boolean }) => void;
function mockMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const abfragen: string[] = [];
  vi.stubGlobal('matchMedia', (query: string) => {
    abfragen.push(query);
    return {
      matches, media: query,
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    };
  });
  return { listeners, abfragen, setze: (v: boolean) => { listeners.forEach((l) => { l({ matches: v }); }); } };
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('useFeinerZeiger', () => {
  it('@SL-153 Maus oder Trackpad (hover: hover, pointer: fine) → wahr; die Abfrage nennt beides, keine Breite', () => {
    const mm = mockMatchMedia(true);
    const { result } = renderHook(() => useFeinerZeiger());
    expect(result.current).toBe(true);
    expect(new Set(mm.abfragen)).toEqual(new Set(['(hover: hover) and (pointer: fine)']));
  });

  it('Gegenbeispiel: Tablet quer (pointer: coarse) → falsch, auch bei großer Breite', () => {
    mockMatchMedia(false);
    expect(renderHook(() => useFeinerZeiger()).result.current).toBe(false);
  });

  it('ein Wechsel des Zeigers (Maus angesteckt) aktualisiert den Wert; beim Abbau wird abgemeldet', () => {
    const mm = mockMatchMedia(false);
    const { result, unmount } = renderHook(() => useFeinerZeiger());
    act(() => { mm.setze(true); });
    expect(result.current).toBe(true);
    unmount();
    expect(mm.listeners.size).toBe(0);
  });

  it('ohne matchMedia (Umgebung ohne Unterstützung) → falsch, kein Fehler', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useFeinerZeiger()).result.current).toBe(false);
  });
});
