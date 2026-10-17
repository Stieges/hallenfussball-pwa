import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSideOrder } from '../useSideOrder';

const spiel11 = { id: 'match-11', homeTeam: { id: 'fc-nord' }, awayTeam: { id: 'sv-sued' } };

describe('useSideOrder – Stufe 1', () => {
  it('@SL-065 Seiten tauschen ändert nur Toms Anzeige: SV Süd links, FC Nord rechts', () => {
    const { result } = renderHook(() => useSideOrder(spiel11));
    expect([result.current.links, result.current.rechts]).toEqual(['home', 'away']);
    act(() => result.current.tausche());
    expect(result.current.getauscht).toBe(true);
    expect([result.current.links, result.current.rechts]).toEqual(['away', 'home']);
  });

  it('Gegenbeispiel: zweimal tauschen ergibt die Grundstellung', () => {
    const { result } = renderHook(() => useSideOrder(spiel11));
    act(() => result.current.tausche());
    act(() => result.current.tausche());
    expect([result.current.links, result.current.rechts]).toEqual(['home', 'away']);
  });
});
