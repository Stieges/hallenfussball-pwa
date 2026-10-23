/**
 * CORRECTION / RESULT_ENTRY -- manuelle Standänderungen durch die Turnierleitung
 * (Brief Abschnitt 3, R8). Ruling K1: beide legen eine "Überschreibung" auf den Stapel
 * (`state.overrides`), mit einem Snapshot des zu diesem Zeitpunkt aus Toren berechneten
 * Stands -- so zählen spätere Tore (z. B. nach REOPEN) auf die Überschreibung weiter, statt
 * unsichtbar zu werden.
 */
import {
  computedScoreFor,
  effectiveScoreFor,
  type EngineEvent,
  type ErrorCode,
  type ForfeitAbsent,
  type MatchContext,
  type MatchState,
  type OverrideRecord,
} from '../types';
import { ERROR_CODES } from '../types';
import { stopClock } from './clock';

export type CorrectionOutcome =
  | { status: 'ok'; state: MatchState }
  | { status: 'rejected'; code: ErrorCode; detail: { currentScores: Record<string, number>; lastScoreEventId: string | null } };

/** RESULT_ENTRY: wie CORRECTION, dazu die Ablehnung einer Wertung außerhalb von `scheduled` (@FU-119). */
export type ResultEntryOutcome =
  | CorrectionOutcome
  | { status: 'rejected'; code: typeof ERROR_CODES.INVALID_TRANSITION; detail: { reason: 'FORFEIT_NOT_SCHEDULED' } };

function snapshotFor(state: MatchState, ctx: MatchContext): Record<string, number> {
  return {
    [ctx.teamAId]: computedScoreFor(state, ctx.teamAId),
    [ctx.teamBId]: computedScoreFor(state, ctx.teamBId),
  };
}

/** STALE_BASE mit dem aktuellen Stand (SQL-Zwilling `match_engine.stale_base_detail`). */
function staleBase(state: MatchState, ctx: MatchContext): Extract<CorrectionOutcome, { status: 'rejected' }> {
  return {
    status: 'rejected',
    code: ERROR_CODES.STALE_BASE,
    detail: {
      currentScores: {
        [ctx.teamAId]: effectiveScoreFor(state, ctx.teamAId),
        [ctx.teamBId]: effectiveScoreFor(state, ctx.teamBId),
      },
      lastScoreEventId: state.lastScoreEventId,
    },
  };
}

/**
 * `basedOn` muss dem zuletzt standändernden Ereignis entsprechen (R8), sonst STALE_BASE
 * mit dem aktuellen Stand als Detail. Sonst wird die Korrektur auf den Überschreibungs-Stapel gelegt.
 */
export function applyCorrection(state: MatchState, event: EngineEvent, ctx: MatchContext): CorrectionOutcome {
  const payload = event.payload as { scores: Record<string, number>; reason: string; basedOn: string | null };
  if (payload.basedOn !== state.lastScoreEventId) {
    return staleBase(state, ctx);
  }

  const override: OverrideRecord = {
    id: event.id,
    kind: 'correction',
    scores: payload.scores,
    snapshot: snapshotFor(state, ctx),
    reason: payload.reason,
    basedOn: payload.basedOn,
    at: event.at,
    seq: state.nextSeq,
  };

  return {
    status: 'ok',
    state: {
      ...state,
      overrides: [...state.overrides, override],
      nextSeq: state.nextSeq + 1,
      lastScoreEventId: event.id,
    },
  };
}

/**
 * RESULT_ENTRY: Direkteintrag, beendet das Spiel sofort mit dem eingegebenen Stand (K1: als Überschreibung).
 * A-25n (@W2A-022): mit `forfeit` ist es eine Nichtantritt-Wertung (Art `forfeit`, Fehlender in `absent`).
 * Spiel beenden (20261110_009, @FU-112, @FU-114, @FU-116, @FU-119): aus einem angepfiffenen Zustand (Übergänge nur für
 * die Turnierleitung) gilt zusätzlich -- eine Wertung nur aus `scheduled` (INVALID_TRANSITION `FORFEIT_NOT_SCHEDULED`),
 * `basedOn` ist Pflicht und muss dem letzten Spielstand-Eintrag entsprechen (sonst STALE_BASE, wie CORRECTION). Die Uhr
 * hält an, eine offene Pause ist zu (für `scheduled` wirkungsgleich). SQL-Zwilling: `match_engine.apply_effect`
 * (Ablehnungen) und `match_engine.apply_result_entry` (Wirkung).
 */
export function applyResultEntry(state: MatchState, event: EngineEvent, ctx: MatchContext): ResultEntryOutcome {
  const payload = event.payload as {
    scores: Record<string, number>;
    shootout?: Record<string, number>;
    forfeit?: { absent: ForfeitAbsent };
    basedOn?: string | null;
  };
  if (state.status !== 'scheduled') {
    if (payload.forfeit !== undefined) {
      return { status: 'rejected', code: ERROR_CODES.INVALID_TRANSITION, detail: { reason: 'FORFEIT_NOT_SCHEDULED' } };
    }
    if (payload.basedOn !== state.lastScoreEventId) {
      return staleBase(state, ctx);
    }
  }
  const override: OverrideRecord = {
    id: event.id,
    kind: payload.forfeit !== undefined ? 'forfeit' : 'direct',
    ...(payload.forfeit !== undefined ? { absent: payload.forfeit.absent } : {}),
    scores: payload.scores,
    // A-25a (@FU-094): Strafstoßergebnis nur übernehmen, wenn eingetragen (kein leerer Schlüssel, wie SQL).
    ...(payload.shootout !== undefined ? { shootout: payload.shootout } : {}),
    snapshot: snapshotFor(state, ctx),
    basedOn: null,
    at: event.at,
    seq: state.nextSeq,
  };
  return {
    status: 'ok',
    state: {
      ...state,
      clock: stopClock(state.clock, event),
      breakStartedAt: null,
      overrides: [...state.overrides, override],
      nextSeq: state.nextSeq + 1,
      finishedAt: event.at,
      lastScoreEventId: event.id,
    },
  };
}
