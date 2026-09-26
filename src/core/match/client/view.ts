/**
 * computeView (RC3, V3): Ansicht aus lokaler Spielkopie berechnen.
 */
import { reduceMatch, applyBatch, type EngineEvent, type MatchContext, type MatchState } from '../';

export interface ViewResult {
  state: MatchState;
  localRejected: EngineEvent[];
  needsFullReload: boolean;
}

export function computeView(copy: { ctx: MatchContext; confirmed: EngineEvent[]; acked: EngineEvent[]; pending: EngineEvent[] }, _serverNow?: number): ViewResult {
  // Basis = reduceMatch auf bestätigtem Log
  const baseResult = reduceMatch(copy.confirmed, copy.ctx);
  const baseState = baseResult.state;

  const openEvents = [...copy.acked, ...copy.pending];
  const openIds = new Set(copy.confirmed.map((e) => e.id));
  const openWithoutDuplicates = openEvents.filter((e) => !openIds.has(e.id));

  const batchResult = applyBatch(baseState, openWithoutDuplicates, copy.ctx);
  const state = batchResult.state;

  // Lokale Ablehnung prüfen
  const localRejected: EngineEvent[] = [];
  let needsFullReload = false;

  for (const ackEvent of copy.acked) {
    const result = batchResult.results.find((r) => r.id === ackEvent.id);
    if (result?.status === 'rejected') {
      needsFullReload = true;
    }
  }

  return {
    state,
    localRejected,
    needsFullReload,
  };
}
