/**
 * B-50 Testhilfen: Klärungseinträge in der Form von `list_match_reviews` und ein angepfiffenes bzw. beendetes Spiel.
 * Namen und Werte aus dem Gherkin (@FU-038, @FU-095, @FU-096, @FU-130): Tom, Olli, FC Nord (Heim), SV Süd (Gast).
 */
import { applyEvent, initialState, type EngineEvent, type MatchContext, type MatchState } from '../..';
import type { MatchReview } from '../matchReviewTypes';

export const NORD = 'team-fc-nord';
export const SUED = 'team-sv-sued';
export const ctx: MatchContext = { matchId: 'match-9', teamAId: NORD, teamBId: SUED };

let counter = 0;
export function review(over: Partial<Omit<MatchReview, 'entry'>> & { entry?: Partial<MatchReview['entry']> } = {}): MatchReview {
  counter += 1;
  const { entry, ...rest } = over;
  return {
    eventId: `ev-${counter}`,
    matchId: 'match-9',
    matchNumber: 9,
    field: 2,
    kind: 'review',
    reason: 'CONTROL_LOST',
    detail: { timing: 'after' },
    receivedAt: 1000 + counter,
    author: 'Tom',
    deviceLabel: 'Handy',
    decision: null,
    ...rest,
    entry: {
      type: 'GOAL',
      teamId: NORD,
      section: 1,
      clockMs: 60_000 + counter,
      payload: {},
      targetId: null,
      deviceAt: 1000,
      ...entry,
    },
  };
}

const rules = (knockout: boolean) => ({
  sections: 1, sectionSeconds: 600, breakSeconds: 60, knockout, tiebreak: knockout ? 'shootout' : null,
  overtimeSeconds: 0, shootersPerTeam: 5, suddenDeathAfter: 5, penaltySeconds: 120,
});

function apply(state: MatchState, event: Omit<EngineEvent, 'section' | 'clockMs' | 'teamId' | 'targetId'> & Partial<EngineEvent>): MatchState {
  const result = applyEvent(state, { section: 1, clockMs: null, teamId: null, targetId: null, ...event }, ctx);
  if (result.status !== 'accepted') {
    throw new Error(`Testaufbau: ${event.type} ${result.status}`);
  }
  return result.state;
}

/** Spiel 9 läuft (Gruppenspiel), 0:0. */
export function runningState(knockout = false): MatchState {
  return apply(initialState(ctx), { id: 's1', type: 'MATCH_START', actor: 'helper', at: 1000, payload: { rules: rules(knockout) } });
}

/** Spiel 9 ist beendet (Olli hat abgepfiffen): Gruppenspiel 0:0, K.-o.-Spiel 1:0 (sonst Strafstoßschießen). */
export function finishedState(knockout = false): MatchState {
  const running = runningState(knockout);
  const scored = knockout
    ? apply(running, { id: 's-tor', type: 'GOAL', actor: 'helper', at: 2000, clockMs: 30_000, teamId: NORD, payload: {} })
    : running;
  return apply(scored, { id: 's2', type: 'MATCH_END', actor: 'leitung', at: 600_000, payload: {} });
}
