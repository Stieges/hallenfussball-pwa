/**
 * A-25c, Gegenbeispiel Torschützenliste (Plan GA4 v2 § 5 A-25c): Record `2026-10-01_endstand-und-torschuetzen` (@ET-035).
 * Wertungstore hat niemand geschossen – die Wertung ist ein Ergebniseintrag (`RESULT_ENTRY`) ohne `GOAL`-Ereignis.
 * Teilabdeckung: der Eintrag mit Wertungsmerkmal (`forfeit`) kommt mit A-25n/B-12; hier der Ergebniseintrag 2:0 über die
 * Engine (`reduceMatch` → `toRuntimeEvents`) und ein Spiel, das über die Cloud-Zeile als Wertung gekennzeichnet ist.
 */
import { describe, expect, it } from 'vitest';
import { reduceMatch, type EngineEvent } from '../../core/match';
import { toRuntimeEvents } from '../../core/match/client';
import { ctx, ev, goal, start } from '../../core/match/client/__tests__/fixtures';
import { calculateScorers } from '../calculations';
import { createMockTournament } from '../../test/factories';
import { looseVs } from '../../test/matchSlotFixtures';
import type { Match, RuntimeMatchEvent } from '../../types/tournament';

function engineEvents(log: EngineEvent[], matchId: string): RuntimeMatchEvent[] {
  const matchCtx = { ...ctx, matchId };
  const { state } = reduceMatch(log, matchCtx);
  return toRuntimeEvents(state, log, matchCtx);
}

/** Spiel um Platz 3: SV Süd (Heim, `teamA`) gegen DJK Berg (Gast, `teamB`), Berg nicht angetreten → 2:0 gewertet. */
const PLATZ3: Match = {
  id: 'platz-3', round: 9, field: 1, isFinal: true, finalType: 'thirdPlace', ...looseVs('teamA', 'teamB'),
  matchStatus: 'finished', scoreA: 2, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B',
};
/** Gruppenspiel, in dem #7 von SV Süd ein Tor geschossen hat (damit die Liste nicht leer ist). */
const GRUPPE: Match = { id: 'gruppe-1', round: 1, field: 1, ...looseVs('teamA', 'teamB'), matchStatus: 'finished', scoreA: 1, scoreB: 0 };

const TOURNAMENT = createMockTournament({
  teams: [{ id: 'teamA', name: 'SV Süd' }, { id: 'teamB', name: 'DJK Berg' }],
  matches: [GRUPPE, PLATZ3],
});

describe('A-25c Wertungstore in der Torschützenliste', () => {
  it('@ET-035:teil Tore einer Wertung erscheinen nicht: kein Eintrag für SV Süd aus dem Spiel um Platz 3, keine Zeile ohne Nummer', () => {
    const wertung = [ev({ id: 'r1', type: 'RESULT_ENTRY', at: 2000, actor: 'leitung', payload: { scores: { teamA: 2, teamB: 0 } } })];
    const map = new Map([
      [PLATZ3.id, engineEvents(wertung, PLATZ3.id)],
      [GRUPPE.id, engineEvents([start(), goal('g1', 'teamA', 2000, 30_000, { playerNumber: 7 })], GRUPPE.id)],
    ]);

    expect(map.get(PLATZ3.id)?.some((e) => e.type === 'GOAL')).toBe(false);
    const scorers = calculateScorers(TOURNAMENT, map);
    expect(scorers).toEqual([{ teamName: 'SV Süd', playerName: '#7', goals: 1, assists: 0 }]);
    expect(scorers.some((s) => s.playerName === 'Unbekannt')).toBe(false);
  });

  it('Gegenbeispiel: ein gespieltes 2:0 im Spiel um Platz 3 mit Toren zählt in der Torschützenliste', () => {
    const gespielt = [start(), goal('g2', 'teamA', 2000, 30_000, { playerNumber: 9 }), goal('g3', 'teamA', 3000, 40_000, { playerNumber: 9 })];
    const map = new Map([[PLATZ3.id, engineEvents(gespielt, PLATZ3.id)]]);
    expect(calculateScorers(TOURNAMENT, map)).toEqual([{ teamName: 'SV Süd', playerName: '#9', goals: 2, assists: 0 }]);
  });
});
