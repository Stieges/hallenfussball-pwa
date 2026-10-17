/**
 * L6 (Schritt 2, Cockpit-Spec § 10 L6): Sperr-Hinweise nach Rot für das aktuelle Spiel aus dem
 * Engine-Zustand aller Turnier-Spiele – nur lesen, kein eigenes `ensureMatch` und keine
 * Sammelabfrage (das macht `useEngineMatches` im Cockpit-Baum für das Turnier).
 *
 * Ohne Engine-Kontext (Gast ohne Provider, isolierte Tests) gilt `[]`.
 */
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Tournament } from '../types/tournament';
import { redCardSuspensions, type SperrHinweis, type SuspensionMatchRef } from '../core/match';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import { buildValidMatches } from './engineMatchModel';

const LEER: SperrHinweis[] = [];

interface SnapshotCache {
  context: MatchEngineContextValue | null;
  matches: readonly SuspensionMatchRef[];
  currentId: string | undefined;
  dirty: boolean;
  value: SperrHinweis[];
}

function gleicheHinweise(a: readonly SperrHinweis[], b: readonly SperrHinweis[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (hinweis, index) =>
        hinweis.teamId === b[index].teamId &&
        hinweis.playerNumber === b[index].playerNumber &&
        hinweis.ausSpielNummer === b[index].ausSpielNummer,
    )
  );
}

/**
 * Sperr-Hinweise für `currentMatchId` (Engine-Spiel-ID oder Original-Schreibweise des Turniers).
 * Gleiches `useSyncExternalStore`-Muster wie `useEngineMatches`: die Engine mutiert außerhalb von
 * React, `getSnapshot` liefert bei unverändertem Inhalt zwingend dieselbe Referenz.
 */
export function useRedCardSuspensions(tournament: Tournament, currentMatchId: string): SperrHinweis[] {
  const context = useMatchEngineContextOptional();
  const matches = useMemo<SuspensionMatchRef[]>(
    () =>
      buildValidMatches(tournament).map((entry) => ({
        id: entry.matchId,
        matchNumber: entry.meta.number,
        teamIds: [entry.ctx.teamAId, entry.ctx.teamBId],
      })),
    [tournament],
  );
  const wanted = currentMatchId.toLowerCase();
  const currentId = matches.find((match) => match.id === wanted)?.id;

  const cacheRef = useRef<SnapshotCache | null>(null);
  const getSnapshot = useCallback((): SperrHinweis[] => {
    const cache = cacheRef.current;
    if (cache && !cache.dirty && cache.context === context && cache.matches === matches && cache.currentId === currentId) {
      return cache.value;
    }
    const berechnet =
      context !== null && currentId !== undefined
        ? redCardSuspensions(matches, (matchId) => context.engine.view(matchId)?.result.state, currentId)
        : LEER;
    const value = cache !== null && gleicheHinweise(cache.value, berechnet) ? cache.value : berechnet;
    cacheRef.current = { context, matches, currentId, dirty: false, value };
    return value;
  }, [context, matches, currentId]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!context) {
        return () => undefined;
      }
      return context.engine.subscribe(() => {
        if (cacheRef.current) {
          cacheRef.current.dirty = true;
        }
        onStoreChange();
      });
    },
    [context],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
