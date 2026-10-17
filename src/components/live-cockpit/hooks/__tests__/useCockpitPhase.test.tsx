import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCockpitPhase } from '../useCockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';

describe('useCockpitPhase (Spec § 4.3, Zustand der Matrix)', () => {
  it('ohne Spiel und ohne Ansicht: kein Spiel (Leerzustand fehlt)', () => {
    const { result } = renderHook(() => useCockpitPhase(null, null, null));
    expect(result.current.zustand).toBe('keinSpiel');
  });

  it('@SL-005 Halbzeitpause aus der Engine-Ansicht, auch wenn LiveMatch PAUSED zeigt', () => {
    const match = makeLiveMatch({ status: 'PAUSED' });
    const view = makePhaseView({ status: 'section_break', section: 1, isLastRegularSection: false });
    const { result } = renderHook(() => useCockpitPhase(match, view, null));
    expect(result.current.zustand).toBe('halbzeitpause');
  });

  it('Leerzustand „wartet auf Herkunft“ hat Vorrang vor dem Spielstatus', () => {
    const match = makeLiveMatch({ status: 'RUNNING' });
    const leer = { art: 'wartetAufHerkunft' as const, gruende: ['Sieger Spiel 9'] };
    const { result } = renderHook(() => useCockpitPhase(match, null, leer));
    expect(result.current.zustand).toBe('wartetAufHerkunft');
  });

  it('neu berechnet, wenn sich der Status des Spiels ändert', () => {
    const { result, rerender } = renderHook(
      ({ status }: { status: 'NOT_STARTED' | 'RUNNING' }) => useCockpitPhase(makeLiveMatch({ status }), null, null),
      { initialProps: { status: 'NOT_STARTED' } },
    );
    expect(result.current.zustand).toBe('vorAnpfiff');
    rerender({ status: 'RUNNING' });
    expect(result.current.zustand).toBe('laeuft');
  });
});
