import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntryFlows, type EntryCommands, type EntryFlowsParams } from '../useEntryFlows';

const commands = (): EntryCommands => ({
  tor: vi.fn().mockResolvedValue('goal-1'), nummer: vi.fn().mockResolvedValue(undefined), eigentor: vi.fn().mockResolvedValue('own-1'),
  foul: vi.fn().mockResolvedValue(undefined), karte: vi.fn().mockResolvedValue(undefined), zeitstrafe: vi.fn().mockResolvedValue(undefined),
});
const basis = (matchId: string): EntryFlowsParams => ({
  matchId, teams: { home: { id: 'fc-nord', name: 'FC Nord' }, away: { id: 'sv-sued', name: 'SV Süd' } },
  commands: commands(), spielzeitJetzt: () => 0, zustand: 'laeuft', melde: vi.fn(), t: (k) => k, hatSchonGelb: () => false,
});

describe('useEntryFlows – offene Auswahl (Stufe 1, auf die Stufe-2-Signatur umgestellt)', () => {
  it('öffnet die Tor-Auswahl für FC Nord (home) und schließt sie wieder', () => {
    const { result } = renderHook(() => useEntryFlows(basis('match-11')));
    act(() => result.current.oeffne({ art: 'tor', seite: 'home' }));
    expect(result.current.offen).toEqual({ art: 'tor', seite: 'home' });
    act(() => result.current.schliesse());
    expect(result.current.offen).toBeNull();
  });

  it('ein Spielwechsel schließt jede offene Auswahl', () => {
    const { result, rerender } = renderHook(({ id }) => useEntryFlows(basis(id)), { initialProps: { id: 'match-11' } });
    act(() => result.current.oeffne({ art: 'karte', seite: 'away', kartenArt: 'YELLOW' }));
    rerender({ id: 'match-12' });
    expect(result.current.offen).toBeNull();
  });

  it('Gegenbeispiel (C1): ein neues Render mit derselben Spiel-ID lässt die Auswahl offen', () => {
    const { result, rerender } = renderHook(({ id }) => useEntryFlows(basis(id)), { initialProps: { id: 'match-11' } });
    act(() => result.current.oeffne({ art: 'tor', seite: 'away' }));
    rerender({ id: 'match-11' });
    expect(result.current.offen).toEqual({ art: 'tor', seite: 'away' });
  });
});
