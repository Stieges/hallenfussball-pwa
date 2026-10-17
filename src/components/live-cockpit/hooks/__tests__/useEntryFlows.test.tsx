import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntryFlows } from '../useEntryFlows';

describe('useEntryFlows – Stufe 1 (offene Auswahl)', () => {
  it('öffnet die Tor-Auswahl für FC Nord (home) und schließt sie wieder', () => {
    const { result } = renderHook(() => useEntryFlows('match-11'));
    act(() => result.current.oeffne({ art: 'tor', seite: 'home' }));
    expect(result.current.offen).toEqual({ art: 'tor', seite: 'home' });
    act(() => result.current.schliesse());
    expect(result.current.offen).toBeNull();
  });

  it('ein Spielwechsel schließt jede offene Auswahl', () => {
    const { result, rerender } = renderHook(({ id }) => useEntryFlows(id), { initialProps: { id: 'match-11' } });
    act(() => result.current.oeffne({ art: 'karte', seite: 'away', kartenArt: 'YELLOW' }));
    rerender({ id: 'match-12' });
    expect(result.current.offen).toBeNull();
  });

  it('Gegenbeispiel (C1): ein neues Render mit derselben Spiel-ID lässt die Auswahl offen', () => {
    const { result, rerender } = renderHook(({ id }) => useEntryFlows(id), { initialProps: { id: 'match-11' } });
    act(() => result.current.oeffne({ art: 'tor', seite: 'away' }));
    rerender({ id: 'match-11' });
    expect(result.current.offen).toEqual({ art: 'tor', seite: 'away' });
  });
});
