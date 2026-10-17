/**
 * useResultEntryAck (A-08f3e2, H-2): die K.-o.-Auflösung nach einem Spielplan-Eintrag läuft erst, wenn der
 * Server den Eintrag angenommen hat (nicht mehr `pending`, Ansicht `finished`). Abgelehnt → keine Auflösung.
 * Gast: sofort (lokal `confirmed`). Gespeichert werden nur Slots (`slotUpdatesAfterResult`).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Tournament } from '../../../types/tournament';
import type { MatchUpdate } from '../../../core/models/types';
import type { MatchEngineContextValue } from '../../match-engine/matchEngineContextInstance';
import type { ValidMatchEntry } from '../../../hooks/engineMatchModel';
import { slotUpdatesAfterResult, withEngineResult } from './scoreChangeHelpers';

interface AwaitedEntry {
  eventId: string;
  entry: ValidMatchEntry;
}

type EntryState = 'pending' | 'accepted' | 'rejected';

export interface UseResultEntryAckOptions {
  context: MatchEngineContextValue | null;
  tournament: Tournament;
  onMatchesUpdate: (updates: MatchUpdate[]) => void;
  /** Offline und K.-o.-relevant: Hinweis `schedule.koAfterSend`. */
  onKoAfterSend: () => void;
}

async function entryState(context: MatchEngineContextValue, awaited: AwaitedEntry): Promise<EntryState> {
  const copy = await context.store.load(context.accountId, awaited.entry.matchId);
  if (!copy || copy.rejected.some((rejected) => rejected.event.id === awaited.eventId)) {
    return 'rejected';
  }
  if (copy.pending.some((event) => event.id === awaited.eventId)) {
    return 'pending';
  }
  const known = [...copy.acked, ...copy.confirmed].some((event) => event.id === awaited.eventId);
  return known ? 'accepted' : 'rejected';
}

export function useResultEntryAck({ context, tournament, onMatchesUpdate, onKoAfterSend }: UseResultEntryAckOptions) {
  const tournamentRef = useRef(tournament);
  tournamentRef.current = tournament;
  const awaitedRef = useRef(new Map<string, AwaitedEntry>());

  const resolveSlots = useCallback(
    (entry: ValidMatchEntry) => {
      if (!context) {
        return;
      }
      const updates = slotUpdatesAfterResult(withEngineResult(tournamentRef.current, entry, context.engine.view(entry.matchId)));
      if (updates.length > 0) {
        onMatchesUpdate(updates);
      }
    },
    [context, onMatchesUpdate],
  );

  const check = useCallback(async () => {
    if (!context) {
      return;
    }
    for (const awaited of [...awaitedRef.current.values()]) {
      const state = await entryState(context, awaited);
      // Zwei Prüfläufe gleichzeitig (mehrere Benachrichtigungen): nur der erste löst auf.
      if (state === 'pending' || !awaitedRef.current.has(awaited.eventId)) {
        continue;
      }
      awaitedRef.current.delete(awaited.eventId);
      const finished = context.engine.view(awaited.entry.matchId)?.result.state.status === 'finished';
      if (state === 'accepted' && finished) {
        resolveSlots(awaited.entry);
      }
    }
  }, [context, resolveSlots]);

  useEffect(() => {
    if (!context) {
      return undefined;
    }
    return context.engine.subscribe(() => {
      void check().catch(() => undefined);
    });
  }, [context, check]);

  return useCallback(
    (eventId: string, entry: ValidMatchEntry) => {
      if (!context) {
        return;
      }
      if (context.accountId === 'guest') {
        resolveSlots(entry);
        return;
      }
      awaitedRef.current.set(eventId, { eventId, entry });
      const wouldResolve = slotUpdatesAfterResult(withEngineResult(tournamentRef.current, entry, context.engine.view(entry.matchId)));
      if (wouldResolve.length > 0 && typeof navigator !== 'undefined' && !navigator.onLine) {
        onKoAfterSend();
      }
      void check().catch(() => undefined);
    },
    [context, resolveSlots, check, onKoAfterSend],
  );
}
