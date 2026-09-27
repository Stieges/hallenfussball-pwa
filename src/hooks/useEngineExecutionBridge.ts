/**
 * useEngineExecutionBridge (I5, C3a-1 Fixrunde 1): buendelt die Engine-Anbindung fuer
 * `useMatchExecution` -- Lesepfad-Map, ein Ref darauf (fuer Effekte/Callbacks, die NICHT bei jeder
 * Engine-Aenderung neu laufen duerfen, s. C1/`useMatchExecution.ts`), den optionalen
 * MatchEngine-Kontext und die gemergte Live-Match-Map (Engine-Spiele gewinnen ueber den Altpfad).
 * Eigene Datei, damit `useMatchExecution.ts` nicht waechst (W11).
 */
import { useCallback, useMemo, useRef, type RefObject } from 'react';
import type { Tournament } from '../types/tournament';
import type { LiveMatch } from '../core/models/LiveMatch';
import { useEngineMatches } from './useEngineMatches';
import { useEngineMatchReadiness } from './useEngineMatchReadiness';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';

export interface UseEngineExecutionBridgeResult {
  engineLiveMatches: Map<string, LiveMatch>;
  engineLiveMatchesRef: RefObject<Map<string, LiveMatch>>;
  matchEngineContext: MatchEngineContextValue | null;
  mergedLiveMatches: Map<string, LiveMatch>;
  /** N2-m3 (Nachtrag C3a-2a): case-insensitiver Mitgliedstest -- der Realtime-Pfad liefert
   * `match_id` klein (Server-Konvention), `engineLiveMatches` ist aber nach `externalId`
   * (Original-Schreibweise aus `tournament.matches[].id`) geschluesselt. Referenzstabil
   * (useCallback auf einem Ref), damit `handleRealtimeChange` sich nicht bei jeder
   * Engine-Aenderung neu abonniert. */
  isEngineMatchId: (matchId: string) => boolean;
  /** B4 (Fixrunde 2, Item 2): true, wenn ein Spiel BEREITS eine Engine-Kopie hat ODER laut B1-Klausel
   * gleich eine bekommt (synchron aus den Turnierdaten, unabhaengig vom asynchronen `ensureMatch`). */
  isEngineDestinedMatchId: (matchId: string) => boolean;
  /** Fixrunde 2, Item 2: fuer den B4-Guard in `useMatchExecution.getLiveMatchData` -- erzwingt
   * `ensureMatch` fuer EIN Spiel, statt auf den naechsten Engine-Notify zu warten. */
  ensureEngineMatchReady: (externalMatchId: string) => Promise<LiveMatch | null>;
  /** P1 (Fixrunde 3, W11): kapselt `engineLiveMatches.get` + `isEngineDestinedMatchId` +
   * `ensureEngineMatchReady` an EINER Stelle -- `null` fuer ein reines Altspiel (Aufrufer weicht
   * auf den Altpfad aus), die Engine-Ansicht direkt oder nach `ensureEngineMatchReady`, sonst ein
   * Wurf (kein Fallback: das Spiel IST/WIRD ein Engine-Spiel, s. B1/B4). */
  resolveEngineLiveMatchData: (externalMatchId: string) => Promise<LiveMatch | null>;
}

export function useEngineExecutionBridge(
  tournament: Tournament,
  enabled: boolean,
  localLiveMatches: Map<string, LiveMatch>,
): UseEngineExecutionBridgeResult {
  const { liveMatches: engineLiveMatches } = useEngineMatches(tournament, enabled, localLiveMatches);
  const matchEngineContext = useMatchEngineContextOptional();
  const { isEngineDestinedMatch, isForeignCandidateMatch, ensureEngineMatchReady } = useEngineMatchReadiness(
    tournament,
    matchEngineContext,
    localLiveMatches,
  );

  const engineLiveMatchesRef = useRef(engineLiveMatches);
  engineLiveMatchesRef.current = engineLiveMatches;

  const mergedLiveMatches = useMemo(() => {
    if (engineLiveMatches.size === 0) { return localLiveMatches; }
    const merged = new Map(localLiveMatches);
    for (const [id, match] of engineLiveMatches) { merged.set(id, match); }
    return merged;
  }, [localLiveMatches, engineLiveMatches]);

  const isEngineMatchId = useCallback(
    (matchId: string): boolean => {
      const lower = matchId.toLowerCase();
      for (const key of engineLiveMatchesRef.current.keys()) {
        if (key.toLowerCase() === lower) {
          return true;
        }
      }
      return false;
    },
    [engineLiveMatchesRef],
  );

  const isEngineDestinedMatchId = useCallback(
    (matchId: string): boolean => isEngineMatchId(matchId) || isEngineDestinedMatch(matchId),
    [isEngineMatchId, isEngineDestinedMatch],
  );

  const resolveEngineLiveMatchData = useCallback(
    async (externalMatchId: string): Promise<LiveMatch | null> => {
      const engineMatch = engineLiveMatchesRef.current.get(externalMatchId);
      if (engineMatch) {
        return engineMatch;
      }
      // P2 (Fixrunde 3, E1-Randfall): "unklar -> vorlaeufig nur lesen" -- fuer den fremd-Kandidaten
      // entscheidet ERST `ensureEngineMatchReady` (ensureMatch + `catchUp`) definitiv, ob der Server
      // Ereignisse hat. `null` heisst hier "bestaetigtes Altspiel" -- KEIN Wurf, der Aufrufer weicht
      // auf den Altweg aus (anders als beim klaren B1-Fall unten).
      if (isForeignCandidateMatch(externalMatchId)) {
        return await ensureEngineMatchReady(externalMatchId);
      }
      if (!isEngineDestinedMatchId(externalMatchId)) {
        return null;
      }
      const ready = await ensureEngineMatchReady(externalMatchId);
      if (ready) {
        return ready;
      }
      throw new Error(`Engine-Spiel ${externalMatchId} ist noch nicht bereit.`);
    },
    [engineLiveMatchesRef, isForeignCandidateMatch, isEngineDestinedMatchId, ensureEngineMatchReady],
  );

  return {
    engineLiveMatches,
    engineLiveMatchesRef,
    matchEngineContext,
    mergedLiveMatches,
    isEngineMatchId,
    isEngineDestinedMatchId,
    ensureEngineMatchReady,
    resolveEngineLiveMatchData,
  };
}
