/**
 * useKoResolutionAfterAck (A-08f3e2 Fixrunde 1, I-1; H-2): besetzt die K.-o.-Plätze, sobald der Server einen
 * Spielplan-Eintrag angenommen hat -- unabhängig vom Spielplan-Tab. Eingebunden in `useTournamentManager`
 * (immer gemountet, solange das Turnier offen ist). Die wartenden Einträge liegen in `koResolutionQueue`
 * (Gerätespeicher), damit Tab-Wechsel und Neuladen nichts verlieren.
 * Angenommen (`acked`/`confirmed`) + Spiel beendet → Slot-Updates (idempotent); abgelehnt → keine Auflösung.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Tournament } from '../types/tournament';
import type { MatchUpdate } from '../core/models/types';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import { buildValidMatches } from './engineMatchModel';
import { readKoQueue, removeFromKoQueue, subscribeKoQueue, type KoAwaitedEntry } from './koResolutionQueue';
import { slotUpdatesAfterResult, withEngineResult } from './koSlotResolution';

type EntryState = 'pending' | 'accepted' | 'rejected';

async function entryState(context: MatchEngineContextValue, awaited: KoAwaitedEntry): Promise<EntryState> {
  const copy = await context.store.load(context.accountId, awaited.matchId);
  if (!copy || copy.rejected.some((rejected) => rejected.event.id === awaited.eventId)) {
    return 'rejected';
  }
  if (copy.pending.some((event) => event.id === awaited.eventId)) {
    return 'pending';
  }
  return [...copy.acked, ...copy.confirmed].some((event) => event.id === awaited.eventId) ? 'accepted' : 'rejected';
}

export function useKoResolutionAfterAck(tournament: Tournament | null, onSlotUpdates: (updates: MatchUpdate[]) => void): void {
  const context = useMatchEngineContextOptional();
  const tournamentRef = useRef(tournament);
  tournamentRef.current = tournament;
  const running = useRef(false);
  const again = useRef(false);

  const checkOnce = useCallback(async (): Promise<void> => {
    const current = tournamentRef.current;
    if (!current || !context) {
      return;
    }
    const done = new Set<string>();
    let resolved = current;
    let accepted = false;
    for (const awaited of readKoQueue(current.id)) {
      const state = await entryState(context, awaited);
      if (state === 'pending') {
        continue;
      }
      done.add(awaited.eventId);
      const entry = buildValidMatches(current).find((candidate) => candidate.matchId === awaited.matchId);
      if (state === 'rejected' || !entry) {
        continue;
      }
      if (!context.engine.view(entry.matchId)) {
        await context.engine.ensureMatch(entry.matchId, entry.ctx, current.id);
      }
      const view = context.engine.view(entry.matchId);
      if (view?.result.state.status === 'finished') {
        resolved = withEngineResult(resolved, entry, view);
        accepted = true;
      }
    }
    if (done.size > 0) {
      removeFromKoQueue(current.id, done);
    }
    const updates = accepted ? slotUpdatesAfterResult(resolved) : [];
    if (updates.length > 0) {
      onSlotUpdates(updates);
    }
  }, [context, onSlotUpdates]);

  // Ein Lauf zur Zeit; Anstöße währenddessen ergeben genau einen weiteren Lauf.
  const check = useCallback(async (): Promise<void> => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        await checkOnce().catch(() => undefined);
      } while (again.current);
    } finally {
      running.current = false;
    }
  }, [checkOnce]);

  const tournamentId = tournament?.id;
  useEffect(() => {
    if (!context || !tournamentId) {
      return undefined;
    }
    void check();
    const stopEngine = context.engine.subscribe(() => { void check(); });
    const stopQueue = subscribeKoQueue((id) => { if (id === tournamentId) { void check(); } });
    return () => { stopEngine(); stopQueue(); };
  }, [context, tournamentId, check]);
}
