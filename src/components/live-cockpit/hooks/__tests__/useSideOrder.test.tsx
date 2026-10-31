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

  // Befund C-SEITENTAUSCH-WIRKT-AUFS-NAECHSTE-SPIEL: das Cockpit bleibt beim Spielwechsel eingebunden, der Tausch gehörte zum alten Spiel
  it('@SL-065 Der Tausch gilt nur für das Spiel, in dem er gewählt wurde: im nächsten Spiel steht das Heimteam wieder links', () => {
    const spiel12 = { id: 'match-12', homeTeam: { id: 'dj-berg' }, awayTeam: { id: 'tsv-west' } };
    const { result, rerender } = renderHook(({ spiel }) => useSideOrder(spiel), { initialProps: { spiel: spiel11 } });
    act(() => result.current.tausche());
    expect(result.current.links).toBe('away');
    rerender({ spiel: spiel12 });
    expect(result.current.getauscht).toBe(false);
    expect([result.current.links, result.current.rechts]).toEqual(['home', 'away']);
  });

  it('@SL-127 Tauscht die Turnierleitung Heim und Gast, zeigt das Cockpit die neue Paarung in der Grundstellung', () => {
    const getauscht = { id: 'match-11', homeTeam: { id: 'sv-sued' }, awayTeam: { id: 'fc-nord' } };
    const { result, rerender } = renderHook(({ spiel }) => useSideOrder(spiel), { initialProps: { spiel: spiel11 } });
    act(() => result.current.tausche());
    rerender({ spiel: getauscht });
    expect([result.current.links, result.current.rechts]).toEqual(['home', 'away']);
  });

  it('Gegenbeispiel: derselbe Spielstand neu gezeichnet behält den Tausch (gleiche Spiel-ID und Paarung)', () => {
    const { result, rerender } = renderHook(({ spiel }) => useSideOrder(spiel), { initialProps: { spiel: spiel11 } });
    act(() => result.current.tausche());
    rerender({ spiel: { ...spiel11, homeTeam: { id: 'fc-nord' } } });
    expect(result.current.links).toBe('away');
  });
});
