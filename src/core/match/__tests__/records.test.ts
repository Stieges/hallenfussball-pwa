/**
 * RR-M1 (Fixrunde 2, Re-Review 1): I7/K5 hatte bisher keinen Test, der ohne den Fix rot wäre --
 * Fixture 06 läuft nur in `phase:'regular'`. Dieser Test simuliert Probe Q7 direkt auf den
 * Handlern: ein Tor fällt in `regular`, die Phase wechselt (B1b bringt die Verlängerung über
 * TIEBREAK_CHOICE), danach wird das Tor zurückgenommen. Ohne den K5-Fix würde `reverseGoal` von
 * der AKTUELLEN Phase abziehen (`overtime`) statt von der Phase, in der das Tor fiel
 * (`regular`), und `overtime` würde negativ.
 */
import { describe, expect, it } from 'vitest';
import { applyGoal, reverseGoal } from '../handlers/records';
import { initialState } from '../applyEvent';
import type { EngineEvent, MatchContext } from '../types';

const ctx: MatchContext = { matchId: 'match-records', teamAId: 'teamA', teamBId: 'teamB' };

describe('reverseGoal zieht in der Tor-Phase ab, nicht in der aktuellen Phase (K5, RR-M1)', () => {
  it('regulär erzieltes Tor bleibt bei Rücknahme in der Verlängerung in regular, nicht overtime', () => {
    const goalEvent: EngineEvent = {
      id: 'goal-regular-1',
      type: 'GOAL',
      actor: 'helper',
      at: 1000,
      section: 1,
      clockMs: 100000,
      teamId: 'teamA',
      payload: {},
    };

    const stateAfterGoal = applyGoal(initialState(ctx), goalEvent, ctx);
    expect(stateAfterGoal.scores.teamA).toEqual({ regular: 1, overtime: 0, shootout: 0 });

    // Phasenwechsel simulieren (in B1a nicht über applyEvent erreichbar, B1b bringt TIEBREAK_CHOICE).
    const stateInOvertime = { ...stateAfterGoal, phase: 'overtime' as const };

    const afterRetract = reverseGoal(stateInOvertime, goalEvent.id);

    expect(afterRetract.scores.teamA).toEqual({ regular: 0, overtime: 0, shootout: 0 });
  });
});
