/**
 * useEngineOverlayForTournament (C3a-2a, W7): ueberlagert JEDE Turnier-Ausgabe von
 * `useTournamentManager` mit dem Engine-Zustand bereits geladener Engine-Spiele -- rein lokal
 * (B3/PC16), kein `syncUp`, kein Versionssprung, keine MutationQueue. Liest NUR den bestehenden
 * `MatchEngine`-Zustand (`engine.view`), ruft selbst NIE `ensureMatch`/`catchUp` (das erledigt
 * `useEngineMatches` im Lesepfad, W3) -- ohne bereits geladene Kopie bleibt ein Spiel unveraendert
 * bei den Rohdaten aus dem Turnier-Repository.
 *
 * Eigene Datei (W11): `useTournamentManager.ts` bindet nur diesen einen Hook ein.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Tournament } from '../types/tournament';
import { applyEngineOverlay, engineOverlayFields, type EngineOverlayFields } from '../core/match/client';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import { buildValidMatches } from './useEngineMatches';

interface OverlayCache {
  tournament: Tournament;
  context: MatchEngineContextValue | null;
  dirty: boolean;
  result: Tournament;
}

/**
 * `mergeBase`: die Referenz, gegen die `applyEngineOverlay` auf Aenderung prueft. OHNE dies wuerde
 * JEDE Neuberechnung (jeder `engine.subscribe`-Aufruf, auch fuer ein voellig unveraendertes
 * Ergebnis) staendig gegen die STATISCHEN Rohdaten (`tournament`, die nie neu geladen werden,
 * solange niemand `setTournament` aufruft) vergleichen -- ein einmal ueberlagertes Feld (z. B.
 * `matchStatus: 'running'`) wiche fuer immer vom rohen `'scheduled'` ab und erzeugte bei JEDER
 * Benachrichtigung ein NEUES `tournament`-Objekt (neue `matches`-Array-Referenz), obwohl sich die
 * Projektion seit der letzten Berechnung gar nicht geaendert hat -- ein Endlos-Renderzyklus mit dem
 * Lade-Effekt in `useMatchExecution.ts` (dessen Abhaengigkeit `tournament.matches` ist), reproduziert
 * per E2E ("Maximum update depth exceeded"). Der Fix: solange die ROHEN Eingabedaten (`tournament`)
 * unveraendert sind, dient das VORHERIGE Ueberlagerungsergebnis als Vergleichsbasis -- nicht die
 * Rohdaten selbst.
 */
function computeOverlaidTournament(
  tournament: Tournament,
  context: MatchEngineContextValue | null,
  previousResult: Tournament | undefined,
): Tournament {
  if (!context) {
    return tournament;
  }
  const overlays = new Map<string, EngineOverlayFields>();
  for (const entry of buildValidMatches(tournament)) {
    const view = context.engine.view(entry.matchId);
    // Nur Spiele mit TATSAECHLICHEM Engine-Inhalt ueberlagern (leerer Log waere ohnehin identisch
    // mit den Rohdaten) -- vermeidet, ein rein "scheduled, noch ohne jedes Ereignis" gefuehrtes
    // Spiel unnoetig anzufassen.
    if (view && view.log.length > 0) {
      overlays.set(entry.externalId, engineOverlayFields(view, entry.ctx));
    }
  }
  return applyEngineOverlay(previousResult ?? tournament, overlays);
}

export function useEngineOverlayForTournament(tournament: Tournament | null): Tournament | null {
  const context = useMatchEngineContextOptional();
  const cacheRef = useRef<OverlayCache | null>(null);

  const getSnapshot = useCallback((): Tournament | null => {
    if (!tournament) {
      return tournament;
    }
    const cache = cacheRef.current;
    if (cache && !cache.dirty && cache.tournament === tournament && cache.context === context) {
      return cache.result;
    }
    // Vergleichsbasis nur wiederverwenden, wenn die ROHEN Eingabedaten unveraendert sind (sonst
    // waere ein echtes Neuladen/eine echte Aenderung faelschlich gegen eine veraltete Basis geprueft).
    const previousResult = cache?.tournament === tournament ? cache.result : undefined;
    const result = computeOverlaidTournament(tournament, context, previousResult);
    cacheRef.current = { tournament, context, dirty: false, result };
    return result;
  }, [tournament, context]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!context) {
        return () => undefined;
      }
      return context.engine.subscribe(() => {
        const cache = cacheRef.current;
        if (cache) {
          cache.dirty = true;
        }
        onStoreChange();
      });
    },
    [context],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
