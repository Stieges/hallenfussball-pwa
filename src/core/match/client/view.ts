/**
 * computeView (RC3, V3): Ansicht aus lokaler Spielkopie berechnen.
 * Basis ist der bestaetigte Log (inkrementell gecacht, I7); offene Eintraege
 * werden wie am Server als Stapel mit Folgeablehnung angewendet. Lokal
 * abgelehnte pending-Einträge werden mit Fehlercode gemeldet (V3: nichts
 * still verwerfen).
 */
import {
  reduceMatch,
  continueLog,
  applyBatch,
  type EngineEvent,
  type ErrorCode,
  type MatchContext,
  type MatchState,
} from '../';

export interface ViewCopy {
  matchId: string;
  confirmed: readonly EngineEvent[];
  acked: readonly EngineEvent[];
  pending: readonly EngineEvent[];
}

export interface LocalRejectedEntry {
  event: EngineEvent;
  code: ErrorCode;
  detail?: unknown;
}

export interface ViewResult {
  state: MatchState;
  localRejected: LocalRejectedEntry[];
  needsFullReload: boolean;
}

interface CachedBase {
  confirmedLength: number;
  lastConfirmedId: string | null;
  state: MatchState;
}

const baseCache = new Map<string, CachedBase>();

/** Basis-Zustand zum bestaetigten Log; nur der neue Praefix wird weitergerechnet (I7). */
function confirmedBase(copy: ViewCopy, ctx: MatchContext): MatchState {
  const confirmed = copy.confirmed;
  const lastConfirmedId = confirmed.length > 0 ? confirmed[confirmed.length - 1].id : null;
  const cached = baseCache.get(copy.matchId);
  const usable =
    cached !== undefined &&
    cached.confirmedLength <= confirmed.length &&
    (cached.confirmedLength === 0 || confirmed[cached.confirmedLength - 1].id === cached.lastConfirmedId);
  const remember = (state: MatchState): MatchState => {
    baseCache.set(copy.matchId, { confirmedLength: confirmed.length, lastConfirmedId, state });
    return state;
  };
  if (cached && usable) {
    const delta = confirmed.slice(cached.confirmedLength);
    return remember(delta.length === 0 ? cached.state : continueLog(cached.state, delta, ctx).state);
  }
  return remember(reduceMatch(confirmed, ctx).state);
}

export function computeView(copy: ViewCopy, ctx: MatchContext): ViewResult {
  const baseState = confirmedBase(copy, ctx);
  const confirmedIds = new Set(copy.confirmed.map((event) => event.id));
  const openWithoutDuplicates = [...copy.acked, ...copy.pending].filter((event) => !confirmedIds.has(event.id));

  const batchResult = applyBatch(baseState, openWithoutDuplicates, ctx);
  const ackedById = new Map(copy.acked.map((event) => [event.id, event]));
  const pendingById = new Map(copy.pending.map((event) => [event.id, event]));

  const localRejected: LocalRejectedEntry[] = [];
  let needsFullReload = false;
  for (const result of batchResult.results) {
    if (result.status !== 'rejected' || result.code === undefined) {
      continue;
    }
    if (ackedById.has(result.id)) {
      // V3: bestaetigte Eintraege duerfen lokal nicht still scheitern.
      needsFullReload = true;
      continue;
    }
    const pendingEvent = pendingById.get(result.id);
    if (pendingEvent) {
      localRejected.push({
        event: pendingEvent,
        code: result.code,
        ...(result.detail !== undefined ? { detail: result.detail } : {}),
      });
    }
  }

  return {
    state: batchResult.state,
    localRejected,
    needsFullReload,
  };
}
