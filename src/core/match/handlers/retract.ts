/**
 * RETRACT -- kehrt die Wirkung eines vorher angenommenen Ereignisses um
 * (Brief Abschnitt 3). Ziel muss in `state.accepted` sein und darf noch nicht
 * zurückgenommen worden sein.
 */
import type { EngineEvent, ErrorCode, MatchContext, MatchState } from '../types';
import { ERROR_CODES } from '../types';
import { RETRACTABLE_EVENT_TYPES } from '../payloadValidation';
import { reverseGoal } from './records';

export type RetractOutcome = { status: 'ok'; state: MatchState } | { status: 'rejected'; code: ErrorCode };

export function applyRetract(state: MatchState, event: EngineEvent, ctx: MatchContext): RetractOutcome {
  // targetId ist bereits durch isPayloadValid() als Pflichtfeld geprüft.
  const targetId = event.targetId ?? '';
  const target = state.accepted[targetId];
  if (!target) {
    return { status: 'rejected', code: ERROR_CODES.UNKNOWN_TARGET };
  }
  if (state.retracted.includes(targetId)) {
    return { status: 'rejected', code: ERROR_CODES.ALREADY_RETRACTED };
  }
  if (!RETRACTABLE_EVENT_TYPES.has(target.type)) {
    return { status: 'rejected', code: ERROR_CODES.INVALID_PAYLOAD };
  }

  const retracted = [...state.retracted, targetId];

  if (target.type === 'GOAL' || target.type === 'OWN_GOAL') {
    return { status: 'ok', state: { ...reverseGoal(state, target, ctx), retracted, lastScoreEventId: event.id } };
  }

  if (target.type === 'CORRECTION') {
    const remainingCorrections = state.corrections.filter((correction) => correction.id !== targetId);
    const lastRemaining = remainingCorrections[remainingCorrections.length - 1] ?? null;
    return {
      status: 'ok',
      state: {
        ...state,
        corrections: remainingCorrections,
        correctedScores: lastRemaining ? lastRemaining.scores : null,
        retracted,
        lastScoreEventId: event.id,
      },
    };
  }

  if (target.type === 'YELLOW_CARD' || target.type === 'YELLOW_RED_CARD' || target.type === 'RED_CARD') {
    return { status: 'ok', state: { ...state, cards: state.cards.filter((c) => c.id !== targetId), retracted } };
  }
  if (target.type === 'TIME_PENALTY') {
    return { status: 'ok', state: { ...state, penalties: state.penalties.filter((p) => p.id !== targetId), retracted } };
  }
  if (target.type === 'FOUL') {
    return { status: 'ok', state: { ...state, fouls: state.fouls.filter((f) => f.id !== targetId), retracted } };
  }
  if (target.type === 'SUBSTITUTION') {
    return {
      status: 'ok',
      state: { ...state, substitutions: state.substitutions.filter((s) => s.id !== targetId), retracted },
    };
  }

  // SHOOTOUT_KICK⁽ᵇ⁾: in B1a wird nie ein Kick gespeichert (Semantik folgt in B1b),
  // die Rücknahme entfernt daher höchstens einen (in B1a nie vorhandenen) Eintrag.
  return {
    status: 'ok',
    state: { ...state, shootoutKicks: state.shootoutKicks.filter((k) => k.id !== targetId), retracted },
  };
}
