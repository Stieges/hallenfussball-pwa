/**
 * computeView (RC3, V3): Ansicht aus lokaler Spielkopie berechnen.
 * Basis ist der bestaetigte Log (inkrementell gecacht, I7); offene Eintraege
 * werden wie am Server als Stapel mit Folgeablehnung angewendet. Lokal
 * abgelehnte pending-Einträge werden mit Fehlercode gemeldet (V3: nichts
 * still verwerfen).
 *
 * Der Cache gilt je Konto und Spiel und prueft das Team-`ctx`; bei Abweichung
 * (z. B. Platzhalter-Teams in der K.-o.-Runde) wird neu gerechnet (N1). Die
 * Map ist auf `VIEW_CACHE_LIMIT` Eintraege begrenzt (aeltester zuerst raus).
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
  accountId: string;
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
  teamAId: string;
  teamBId: string;
  confirmedLength: number;
  lastConfirmedId: string | null;
  state: MatchState;
}

export const VIEW_CACHE_LIMIT = 32;

const baseCache = new Map<string, CachedBase>();

/** Fuer Tests: Cache verwerfen. */
export function clearViewCache(): void {
  baseCache.clear();
}

/** Fuer Tests: aktuelle Anzahl gecachter Basen. */
export function viewCacheSize(): number {
  return baseCache.size;
}

/** Cache-Treffer nur bei gleichem Team-`ctx`, passendem Praefix und nicht geschrumpftem Log (N1). */
function isReusable(cached: CachedBase, confirmed: readonly EngineEvent[], ctx: MatchContext): boolean {
  return (
    cached.teamAId === ctx.teamAId &&
    cached.teamBId === ctx.teamBId &&
    cached.confirmedLength <= confirmed.length &&
    (cached.confirmedLength === 0 || confirmed[cached.confirmedLength - 1].id === cached.lastConfirmedId)
  );
}

/** Basis-Zustand zum bestaetigten Log; nur der neue Praefix wird weitergerechnet (I7). */
function confirmedBase(copy: ViewCopy, ctx: MatchContext): MatchState {
  const confirmed = copy.confirmed;
  const lastConfirmedId = confirmed.length > 0 ? confirmed[confirmed.length - 1].id : null;
  const key = `${copy.accountId}|${copy.matchId}`;
  const cached = baseCache.get(key);
  const usable = cached !== undefined && isReusable(cached, confirmed, ctx);
  const remember = (state: MatchState): MatchState => {
    if (baseCache.has(key)) {
      baseCache.delete(key);
    }
    baseCache.set(key, {
      teamAId: ctx.teamAId,
      teamBId: ctx.teamBId,
      confirmedLength: confirmed.length,
      lastConfirmedId,
      state,
    });
    while (baseCache.size > VIEW_CACHE_LIMIT) {
      const oldest = baseCache.keys().next();
      if (oldest.done) {
        break;
      }
      baseCache.delete(oldest.value);
    }
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
