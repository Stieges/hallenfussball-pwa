/**
 * useEngineMatchReadiness (C3a-2a Fixrunde 2, Item 2 / B4-Race): eigene Datei (W11), damit
 * `useEngineMatches.ts` durch die B4-Race-Wache nicht weiter waechst (Report-Auflage Fixrunde 2,
 * Item 7). Liefert fuer EIN Spiel synchron die B1-Klassifizierung (`isEngineDestinedMatch`,
 * unabhaengig vom asynchronen `ensureMatch`-Effekt in `useEngineMatches`) und einen Weg,
 * `ensureMatch` fuer genau dieses Spiel zu erzwingen und danach dessen Engine-Ansicht zu lesen
 * (`ensureEngineMatchReady`).
 *
 * Fuer den B4-Guard in `useMatchExecution.getLiveMatchData`: der Altpfad (`service.initializeMatch`,
 * `liveMatchRepository.save`) darf fuer ein Engine-Spiel NIE laufen -- auch nicht in der kurzen Race
 * zwischen dem Mount (`ManagementTab`) und dem asynchronen `ensureMatch` (IndexedDB-Schreibzugriff),
 * die `engineLiveMatches` (aus `useEngineMatches`) erst danach fuellt. `isEngineDestinedMatch`
 * braucht dafuer keine Engine-Ansicht -- nur die Turnierdaten selbst (`buildValidMatches` +
 * `isNewScheduledMatch`, P8/Fixrunde 3: beide in `./engineMatchModel`).
 */
import { useCallback, useMemo, useRef } from 'react';
import type { Tournament } from '../types/tournament';
import type { LiveMatch } from '../core/models/LiveMatch';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import { buildValidMatches, computeLiveMatches, isNewScheduledMatch } from './engineMatchModel';

export interface UseEngineMatchReadinessResult {
  /** B4: synchron aus den Turnierdaten ableitbar (dieselbe B1-Klausel wie `isNewScheduledMatch`)
   * -- anders als der `isEngineMatch`-Lesepfad haengt das NICHT davon ab, ob `ensureMatch` fuer
   * dieses Spiel schon durchgelaufen ist. */
  isEngineDestinedMatch: (externalMatchId: string) => boolean;
  /** Erzwingt (falls noetig) `ensureMatch` fuer EIN Spiel und liefert danach dessen Engine-Ansicht,
   * statt auf den naechsten `engine.subscribe`-Zyklus zu warten. `null`, wenn es (noch) keinen
   * Kontext gibt oder das Spiel keine Engine-Ansicht ergibt. */
  ensureEngineMatchReady: (externalMatchId: string) => Promise<LiveMatch | null>;
}

export function useEngineMatchReadiness(
  tournament: Tournament,
  context: MatchEngineContextValue | null,
  localLiveMatches: Map<string, LiveMatch>,
): UseEngineMatchReadinessResult {
  const validMatches = useMemo(() => buildValidMatches(tournament), [tournament]);
  const validMatchesRef = useRef(validMatches);
  validMatchesRef.current = validMatches;

  const isEngineDestinedMatch = useCallback(
    (externalMatchId: string): boolean => {
      // Dieselbe Vorbedingung wie `computeLiveMatches` (kein Kontext -> kein Engine-Spiel) --
      // sonst wuerde ein Gast/Ladezustand ohne Engine-Anbindung faelschlich vom Altpfad ausgesperrt.
      if (!context) {
        return false;
      }
      const entry = validMatches.find((candidate) => candidate.externalId === externalMatchId);
      return !!entry && isNewScheduledMatch(entry, localLiveMatches);
    },
    [context, validMatches, localLiveMatches],
  );

  const ensureEngineMatchReady = useCallback(
    async (externalMatchId: string): Promise<LiveMatch | null> => {
      if (!context) {
        return null;
      }
      const entry = validMatchesRef.current.find((candidate) => candidate.externalId === externalMatchId);
      if (!entry) {
        return null;
      }
      await context.engine.ensureMatch(entry.matchId, entry.ctx, tournament.id);
      // Leere Menge statt der eigentlichen `engineMatchIds` aus `useEngineMatches`: diese Funktion
      // wird nur fuer bereits als `isNewScheduledMatch` klassifizierte Eintraege aufgerufen (s.
      // `isEngineDestinedMatch`/`getLiveMatchData`), `computeLiveMatches` haengt fuer GENAU diese
      // Einordnung ohnehin nicht von `engineMatchIds` ab (die B1-Klausel greift unabhaengig davon).
      const computed = computeLiveMatches(context, [entry], new Set<string>(), tournament, localLiveMatches);
      return computed.get(externalMatchId) ?? null;
    },
    [context, tournament, localLiveMatches],
  );

  return { isEngineDestinedMatch, ensureEngineMatchReady };
}
