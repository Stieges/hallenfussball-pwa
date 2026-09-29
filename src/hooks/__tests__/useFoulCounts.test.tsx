/**
 * useFoulCounts (C3b-2, G11): Fouls werden aus den FOUL-Eintraegen in `LiveMatch.events`
 * gezaehlt -- fuer das ganze Spiel, ohne Halbzeit-Reset und ohne lokales +1. Zurueckgenommene
 * Eintraege stehen nicht in `events` (G6/RC13) und duerfen ueber `retractedEvents` NICHT
 * mitgezaehlt werden.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFoulCounts } from '../useFoulCounts';
import type { RuntimeMatchEvent } from '../../types/tournament';

function foul(id: string, teamId: string): RuntimeMatchEvent {
  return {
    id,
    matchId: 'match-1',
    timestampSeconds: 10,
    type: 'FOUL',
    payload: { teamId },
    scoreAfter: { home: 0, away: 0 },
  };
}

function matchWith(events: RuntimeMatchEvent[], retractedEvents?: RuntimeMatchEvent[]) {
  return {
    homeTeam: { id: 'teama', name: 'FC Alpha' },
    awayTeam: { id: 'teamb', name: 'SV Beta' },
    events,
    ...(retractedEvents !== undefined ? { retractedEvents } : {}),
  };
}

describe('useFoulCounts (G11)', () => {
  it('zurückgenommenes Foul zählt nicht', () => {
    const { result } = renderHook(() =>
      useFoulCounts(
        matchWith(
          [foul('f1', 'teama'), foul('f2', 'teama'), foul('f3', 'teamb')],
          [foul('f0', 'teama')],
        ),
      ),
    );
    expect(result.current).toEqual({ home: 2, away: 1 });
  });

  it('zaehlt nur FOUL-Eintraege und nur die beiden Teams', () => {
    const { result } = renderHook(() =>
      useFoulCounts(
        matchWith([
          foul('f1', 'teama'),
          { ...foul('g1', 'teama'), type: 'GOAL' },
          foul('f2', 'unbekannt'),
        ]),
      ),
    );
    expect(result.current).toEqual({ home: 1, away: 0 });
  });

  it('ohne Match, ohne Teams oder ohne Events: 0:0', () => {
    expect(renderHook(() => useFoulCounts(null)).result.current).toEqual({ home: 0, away: 0 });
    expect(renderHook(() => useFoulCounts(undefined)).result.current).toEqual({ home: 0, away: 0 });
    expect(
      renderHook(() => useFoulCounts({ homeTeam: { id: 'teama' }, awayTeam: { id: 'teamb' } })).result.current,
    ).toEqual({ home: 0, away: 0 });
  });
});
