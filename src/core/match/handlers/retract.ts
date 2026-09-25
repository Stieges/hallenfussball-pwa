/**
 * RETRACT -- kehrt die Wirkung eines vorher angenommenen Ereignisses um
 * (Brief Abschnitt 3). Ziel muss in `state.accepted` sein und darf noch nicht
 * zurückgenommen worden sein.
 */
import { RETRACTABLE_EVENT_TYPES } from '../payloadValidation';
import { ERROR_CODES, effectiveScoreFor } from '../types';
import type { EngineEvent, ErrorCode, MatchContext, MatchState } from '../types';
import { reverseGoal } from './records';
import { reverseShootoutKick } from './shootout';

export type RetractOutcome =
  | { status: 'ok'; state: MatchState }
  | { status: 'rejected'; code: ErrorCode; detail?: { currentScores: Record<string, number>; lastScoreEventId: string | null } };

function staleBaseDetail(state: MatchState, ctx: MatchContext): { currentScores: Record<string, number>; lastScoreEventId: string | null } {
  return {
    currentScores: {
      [ctx.teamAId]: effectiveScoreFor(state, ctx.teamAId),
      [ctx.teamBId]: effectiveScoreFor(state, ctx.teamBId),
    },
    lastScoreEventId: state.lastScoreEventId,
  };
}

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
    // Ruling K10: RESULT_ENTRY ist bewusst NICHT in RETRACTABLE_EVENT_TYPES -- ein Direkteintrag
    // lässt sich nie zurücknehmen (auch nicht durch die Turnierleitung), Fehler behebt eine
    // CORRECTION. Dieser Zweig fängt das für jeden Akteur ab, der die allgemeine
    // Tabellenzeilen-Prüfung passiert hat (Fixrunde 2, RR-I2).
    return { status: 'rejected', code: ERROR_CODES.INVALID_PAYLOAD };
  }

  // Ruling K2 (Fixrunde 2 präzisiert, RR-I2): NUR CORRECTION verlangt zwingend die
  // Turnierleitung -- RESULT_ENTRY erreicht diesen Zweig nie, weil es oben bereits als nicht
  // zurücknehmbar abgelehnt wird (K10).
  if (target.type === 'CORRECTION' && event.actor !== 'leitung') {
    return { status: 'rejected', code: ERROR_CODES.FORBIDDEN_ACTOR };
  }

  const retracted = [...state.retracted, targetId];

  if (target.type === 'GOAL' || target.type === 'OWN_GOAL') {
    // Ruling K9 (Fixrunde 2, RR-I1): ein Tor, das VOR der letzten aktiven Überschreibung fiel,
    // ist in deren Stand schon "eingerechnet" -- seine Rücknahme würde effectiveScoreFor unter
    // 0 drücken. Solche Rücknahmen werden abgelehnt wie eine veraltete CORRECTION (STALE_BASE,
    // gleiches Detail-Format); der richtige Weg ist danach eine neue CORRECTION. Ein Tor NACH
    // der letzten Überschreibung bleibt normal zurücknehmbar.
    const goalRecord = state.goals.find((goal) => goal.id === targetId);
    const lastOverride = state.overrides[state.overrides.length - 1];
    if (goalRecord && lastOverride && goalRecord.seq < lastOverride.seq) {
      return { status: 'rejected', code: ERROR_CODES.STALE_BASE, detail: staleBaseDetail(state, ctx) };
    }
    return { status: 'ok', state: { ...reverseGoal(state, targetId), retracted, lastScoreEventId: event.id } };
  }

  if (target.type === 'CORRECTION') {
    return {
      status: 'ok',
      state: {
        ...state,
        overrides: state.overrides.filter((override) => override.id !== targetId),
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

  // SHOOTOUT_KICK (B1b, B-U6): nur im laufenden Strafstoßschießen zurücknehmbar, sonst
  // INVALID_PAYLOAD; nimmt einen Treffer zurück. lastScoreEventId bleibt: Schüsse ändern den
  // effektiven Stand (regular+overtime) nicht.
  if (state.status !== 'shootout') {
    return { status: 'rejected', code: ERROR_CODES.INVALID_PAYLOAD };
  }
  return { status: 'ok', state: { ...reverseShootoutKick(state, targetId), retracted } };
}
