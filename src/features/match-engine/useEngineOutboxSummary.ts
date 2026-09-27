/**
 * useEngineOutboxSummary (C3a-2a, Nachtrag W1): Turnier-bezogene Zaehler + die Ablehnungen aus
 * `useOutboxStatus(engine.sender)`/`store.forAccount` fuer den Dialog. `dismiss` gruppiert nach
 * Spiel und ruft `sender.dismissRejected(matchId, ids)` je Spiel (m7: benachrichtigt die
 * MatchEngine, die Ansicht aktualisiert sich ohne Neuladen); die Liste wird danach neu eingelesen.
 *
 * `reviewCount` ist bewusst 0: der Review-Workflow (Turnierleitung bestaetigt/verwirft Eintraege
 * eines Helfers) ist noch nicht verdrahtet (C3d) -- `status.reviewByMatch` global zu summieren
 * waere hier nicht auf DIESES Turnier begrenzt und damit falsch.
 */
import { useCallback, useEffect, useState } from 'react';
import type { RejectedEntry } from '../../core/match/client';
import { useMatchEngineContextOptional } from './useMatchEngineContext';
import { useOutboxStatus, pendingForTournament } from '../collaboration/outbox/useOutboxStatus';

export interface EngineRejectedEntry extends RejectedEntry {
  matchId: string;
}

export interface EngineOutboxSummary {
  pendingCount: number;
  rejectedCount: number;
  reviewCount: number;
  entries: EngineRejectedEntry[];
  dismiss: (ids: string[]) => Promise<void>;
}

export function useEngineOutboxSummary(tournamentId: string): EngineOutboxSummary {
  const context = useMatchEngineContextOptional();
  const status = useOutboxStatus(context?.sender ?? null);
  const [entries, setEntries] = useState<EngineRejectedEntry[]>([]);

  const refresh = useCallback(async () => {
    if (!context) {
      setEntries([]);
      return;
    }
    const copies = await context.store.forAccount(context.accountId);
    const forTournament = copies.filter((copy) => copy.tournamentId === tournamentId);
    setEntries(
      forTournament.flatMap((copy) => copy.rejected.map((entry) => ({ ...entry, matchId: copy.matchId }))),
    );
  }, [context, tournamentId]);

  // `status` aendert sich bei jeder Ablehnung/jedem "Verstanden" (ueber sender.subscribe) -- die
  // Liste selbst kommt aus dem Store (nicht Teil von OutboxStatus) und wird deshalb parallel neu
  // eingelesen.
  useEffect(() => {
    void refresh();
  }, [refresh, status]);

  const dismiss = useCallback(
    async (ids: string[]) => {
      if (!context) {
        return;
      }
      const idSet = new Set(ids);
      const byMatch = new Map<string, string[]>();
      for (const entry of entries) {
        if (!idSet.has(entry.event.id)) {
          continue;
        }
        const list = byMatch.get(entry.matchId) ?? [];
        list.push(entry.event.id);
        byMatch.set(entry.matchId, list);
      }
      await Promise.all(
        [...byMatch.entries()].map(([matchId, matchIds]) => context.sender.dismissRejected(matchId, matchIds)),
      );
      await refresh();
    },
    [context, entries, refresh],
  );

  return {
    pendingCount: pendingForTournament(status, tournamentId),
    // Turnier-scoped: `entries` ist bereits auf dieses Turnier gefiltert (s. o.).
    rejectedCount: entries.length,
    reviewCount: 0,
    entries,
    dismiss,
  };
}
