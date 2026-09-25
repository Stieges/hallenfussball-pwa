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

const GOAL_TYPES: ReadonlySet<string> = new Set(['GOAL', 'OWN_GOAL']);

/**
 * Zieltyp-Zulässigkeit je Status/Phase (B-U16 Schritt 2) -- false => INVALID_PAYLOAD:
 * - K10: Typ nicht in RETRACTABLE_EVENT_TYPES (u. a. MATCH_END, RESULT_ENTRY).
 * - B-U10: im Strafstoßschießen nur SHOOTOUT_KICK; in der Pause vor der Verlängerung keine Tore.
 * - B-U6/B-U12: SHOOTOUT_KICK nur im Strafstoßschießen; nach Spielende keine Tore/Eigentore.
 * - B-U15: in phase overtime kein Tor, das in der regulären Zeit fiel.
 * Bewusst unabhängig davon, ob das Ziel schon zurückgenommen ist (Tor-Einträge bleiben erhalten).
 */
function isTargetAdmissible(state: MatchState, target: EngineEvent): boolean {
  if (!RETRACTABLE_EVENT_TYPES.has(target.type)) {
    return false;
  }
  if (state.status === 'shootout') {
    return target.type === 'SHOOTOUT_KICK';
  }
  if (target.type === 'SHOOTOUT_KICK') {
    return false;
  }
  if (!GOAL_TYPES.has(target.type)) {
    return true;
  }
  if (state.status === 'finished') {
    return false;
  }
  if (state.phase === 'overtime') {
    if (state.status === 'section_break') {
      return false;
    }
    const goalRecord = state.goals.find((goal) => goal.id === target.id);
    return goalRecord?.phase !== 'regular';
  }
  return true;
}

/**
 * Prüfreihenfolge (Ruling B-U16, verbindlich auch für B3a): UNKNOWN_TARGET -> Zieltyp-Zulässigkeit
 * (INVALID_PAYLOAD) -> K2 (FORBIDDEN_ACTOR) -> ALREADY_RETRACTED -> K9 (STALE_BASE) -> Wirkung.
 */
export function applyRetract(state: MatchState, event: EngineEvent, ctx: MatchContext): RetractOutcome {
  // targetId ist bereits durch isPayloadValid() als Pflichtfeld geprüft.
  const targetId = event.targetId ?? '';
  // M1 (B3a-Review): nur eigene Schlüssel -- `constructor`/`__proto__` sind unbekannte Ziele.
  const target = Object.hasOwn(state.accepted, targetId) ? state.accepted[targetId] : undefined;
  if (!target) {
    return { status: 'rejected', code: ERROR_CODES.UNKNOWN_TARGET };
  }
  if (!isTargetAdmissible(state, target)) {
    return { status: 'rejected', code: ERROR_CODES.INVALID_PAYLOAD };
  }
  // Ruling K2: eine CORRECTION nimmt nur die Turnierleitung zurück (RESULT_ENTRY scheitert schon an K10).
  if (target.type === 'CORRECTION' && event.actor !== 'leitung') {
    return { status: 'rejected', code: ERROR_CODES.FORBIDDEN_ACTOR };
  }
  if (state.retracted.includes(targetId)) {
    return { status: 'rejected', code: ERROR_CODES.ALREADY_RETRACTED };
  }

  const retracted = [...state.retracted, targetId];

  if (GOAL_TYPES.has(target.type)) {
    // Ruling K9: ein Tor, das VOR der letzten aktiven Überschreibung fiel, ist in deren Stand schon
    // eingerechnet -- Rücknahme -> STALE_BASE (Detail wie bei CORRECTION); danach neue CORRECTION.
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

  // SHOOTOUT_KICK (nur in status shootout, siehe isTargetAdmissible): nimmt einen Treffer zurück.
  // lastScoreEventId bleibt: Schüsse ändern den effektiven Stand (regular+overtime) nicht.
  return { status: 'ok', state: { ...reverseShootoutKick(state, targetId), retracted } };
}
