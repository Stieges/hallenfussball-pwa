/**
 * useFoulCounts (C3b-2, G11): Foul-Zaehler eines Spiels aus den FOUL-Eintraegen in
 * `LiveMatch.events` -- fuer das ganze Spiel, ohne Halbzeit-Reset und ohne lokales +1.
 * `events` enthaelt kein Zurueckgenommenes (G6/RC13); `retractedEvents` wird nicht gelesen.
 * M9: die Ersatz-Aussagen laufen ueber die echte Kette Engine-Log -> reduceMatch ->
 * toLiveMatchView -> useFoulCounts, nicht ueber handgebaute `retractedEvents`-Felder.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFoulCounts } from '../useFoulCounts';
import type { RuntimeMatchEvent } from '../../types/tournament';
import { reduceMatch, type EngineEvent } from '../../core/match';
import { toLiveMatchView } from '../../core/match/client';
import { T, ctx, ev, meta, start } from '../../core/match/client/__tests__/fixtures';

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

function matchWith(events: RuntimeMatchEvent[]) {
  return {
    homeTeam: { id: 'teama', name: 'FC Alpha' },
    awayTeam: { id: 'teamb', name: 'SV Beta' },
    events,
  };
}

/** Kette Engine-Log -> reduceMatch -> toLiveMatchView -> useFoulCounts (M9). */
function countViaChain(log: EngineEvent[]): { home: number; away: number } {
  const { state } = reduceMatch(log, ctx);
  const match = toLiveMatchView(state, meta, { serverNow: T, offsetMs: 0 }, log);
  return renderHook(() => useFoulCounts(match)).result.current;
}

describe('useFoulCounts (G11)', () => {
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

describe('über den Adapter (M9): Engine-Log → toLiveMatchView → useFoulCounts', () => {
  it('zurückgenommenes Foul zählt nicht, ohne RETRACT zählt es 1', () => {
    const f = ev({ id: 'f1', type: 'FOUL', at: 2000, teamId: 'teamA', clockMs: 20_000, payload: {} });
    expect(countViaChain([start(), f])).toEqual({ home: 1, away: 0 });
    expect(
      countViaChain([start(), f, ev({ id: 'r1', type: 'RETRACT', at: 3000, targetId: 'f1' })]),
    ).toEqual({ home: 0, away: 0 });
  });

  it('zurückgenommene Karte zählt nicht (Kette Engine-Log → View → useFoulCounts = 0)', () => {
    const log = [
      start(),
      ev({ id: 'k1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 4 } }),
      ev({ id: 'r1', type: 'RETRACT', at: 3000, targetId: 'k1' }),
    ];
    expect(countViaChain(log)).toEqual({ home: 0, away: 0 });
  });

  it('Fouls je Team via toLiveMatchView (Ersatz-Aussage foulCounts)', () => {
    const log = [
      start(),
      ev({ id: 'f1', type: 'FOUL', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: {} }),
      ev({ id: 'f2', type: 'FOUL', at: 2500, teamId: 'teamA', clockMs: 20_000, payload: {} }),
      ev({ id: 'f3', type: 'FOUL', at: 3000, teamId: 'teamB', clockMs: 30_000, payload: {} }),
    ];
    expect(countViaChain(log)).toEqual({ home: 2, away: 1 });
  });
});
