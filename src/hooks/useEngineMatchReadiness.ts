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
import { buildValidMatches, computeLiveMatches, isNewScheduledMatch, type ValidMatchEntry } from './engineMatchModel';

export interface UseEngineMatchReadinessResult {
  /** B4: synchron aus den Turnierdaten ableitbar -- entweder die klare B1-Klausel
   * (`isNewScheduledMatch`) ODER der P2/E1-Randfall (`isForeignCandidateMatch`, s. dort). Anders
   * als der `isEngineMatch`-Lesepfad haengt das NICHT davon ab, ob `ensureMatch` fuer dieses Spiel
   * schon durchgelaufen ist. */
  isEngineDestinedMatch: (externalMatchId: string) => boolean;
  /** P2 (Fixrunde 3, E1-Randfall): "unklar -> vorlaeufig nur lesen". Ein Spiel, das auf einem
   * ANDEREN Geraet bereits laeuft, hat `matchStatus` != `'scheduled'` (RPC-Projektion), aber auf
   * DIESEM Geraet weder eine Altzeile noch ein Ergebnis -- die reine B1-Klausel (nur `scheduled`)
   * wuerde es faelschlich als Altspiel behandeln (`service.initializeMatch`/`save` liefen, ein
   * Anpfiff ginge ueber den Altweg). Dieser Fall ist erst nach `ensureEngineMatchReady`
   * (ensureMatch + `catchUp`) definitiv aufgeloest: liefert der Server Ereignisse, ist es ein
   * Engine-Spiel; liefert er keine, ist es ein bestaetigtes Altspiel (Aufrufer darf dann NICHT
   * werfen, sondern muss auf den Altweg ausweichen -- anders als beim klaren B1-Fall). */
  isForeignCandidateMatch: (externalMatchId: string) => boolean;
  /** Erzwingt (falls noetig) `ensureMatch` + `catchUp` fuer EIN Spiel und liefert danach dessen
   * Engine-Ansicht, statt auf den naechsten `engine.subscribe`-Zyklus zu warten. `null`, wenn es
   * (noch) keinen Kontext gibt, das Spiel keine Engine-Ansicht ergibt, oder (P2) der Server fuer
   * ein "fremdes" Spiel keine Ereignisse hat (dann ist es ein bestaetigtes Altspiel). */
  ensureEngineMatchReady: (externalMatchId: string) => Promise<LiveMatch | null>;
}

/**
 * P2 (Fixrunde 3, E1-Randfall): nicht `scheduled`, aber (auf DIESEM Geraet) weder eine aktive
 * Altzeile noch ein Ergebnis -- der Kandidat fuer ein fremd (auf einem anderen Geraet) laufendes
 * Engine-Spiel. Spiegelbildlich zu `isNewScheduledMatch` (dort: `scheduled`).
 */
function isForeignCandidate(entry: ValidMatchEntry, localLiveMatches: Map<string, LiveMatch>): boolean {
  const isScheduled = (entry.matchStatus ?? 'scheduled') === 'scheduled';
  if (isScheduled || entry.hasExistingResult) {
    return false;
  }
  const oldLiveMatch = localLiveMatches.get(entry.externalId);
  return !oldLiveMatch || oldLiveMatch.status === 'NOT_STARTED';
}

export function useEngineMatchReadiness(
  tournament: Tournament,
  context: MatchEngineContextValue | null,
  localLiveMatches: Map<string, LiveMatch>,
): UseEngineMatchReadinessResult {
  const validMatches = useMemo(() => buildValidMatches(tournament), [tournament]);
  const validMatchesRef = useRef(validMatches);
  validMatchesRef.current = validMatches;

  const isForeignCandidateMatch = useCallback(
    (externalMatchId: string): boolean => {
      if (!context) {
        return false;
      }
      const entry = validMatches.find((candidate) => candidate.externalId === externalMatchId);
      return !!entry && isForeignCandidate(entry, localLiveMatches);
    },
    [context, validMatches, localLiveMatches],
  );

  const isEngineDestinedMatch = useCallback(
    (externalMatchId: string): boolean => {
      // Dieselbe Vorbedingung wie `computeLiveMatches` (kein Kontext -> kein Engine-Spiel) --
      // sonst wuerde ein Gast/Ladezustand ohne Engine-Anbindung faelschlich vom Altpfad ausgesperrt.
      if (!context) {
        return false;
      }
      const entry = validMatches.find((candidate) => candidate.externalId === externalMatchId);
      return !!entry && (isNewScheduledMatch(entry, localLiveMatches) || isForeignCandidate(entry, localLiveMatches));
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
      // P2: fuer ein fremd laufendes Spiel (matchStatus != 'scheduled') hat `ensureMatch` allein
      // ggf. nur eine LEERE lokale Kopie -- `catchUp` holt die bestaetigten Ereignisse vom Server,
      // damit `computeLiveMatches`s `hasLocalEvents`-Erkennung es ueberhaupt als Engine-Spiel sieht.
      // Fuer ein echtes B1-neues Spiel ist das ein harmloser (leerer) Netzaufruf.
      await context.engine.catchUp(entry.matchId);
      // Leere Menge statt der eigentlichen `engineMatchIds` aus `useEngineMatches`: diese Funktion
      // wird nur fuer bereits als engine-destined klassifizierte Eintraege aufgerufen (s.
      // `isEngineDestinedMatch`/`resolveEngineLiveMatchData`); nach `catchUp` zeigt `hasLocalEvents`
      // (in `computeLiveMatches`) korrekt an, ob der Server tatsaechlich Ereignisse hatte.
      const computed = computeLiveMatches(context, [entry], new Set<string>(), tournament, localLiveMatches);
      return computed.get(externalMatchId) ?? null;
    },
    [context, tournament, localLiveMatches],
  );

  return { isEngineDestinedMatch, isForeignCandidateMatch, ensureEngineMatchReady };
}
