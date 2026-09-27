/**
 * useEngineMatches (C3a-1, Teil 1.3): Lesepfad fuer Engine-Spiele. Baut fuer jedes gueltige
 * Spiel des Turniers eine lokale Kopie an (`ensureMatch`, W4: keine Platzhalter-Teams), ermittelt
 * per Sammelabfrage (W3) welche Spiele bereits Engine-Ereignisse haben, und liefert fuer genau
 * diese Spiele eine `LiveMatch`-Ansicht aus der Engine (B1, C3a-1: OHNE die „scheduled“-Klausel --
 * ein Spiel ohne jedes Ereignis bleibt in diesem Schritt ein Altspiel).
 *
 * Eigene Datei statt in `useMatchExecution` (W11): die Datei ist bereits an der 300-Zeilen-Grenze.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Tournament } from '../types/tournament';
import type { LiveMatch } from '../core/models/LiveMatch';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import { fetchEngineMatchIds, type EngineMatchIdsQueryClient } from '../features/match-engine/fetchEngineMatchIds';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { scheduleFingerprint } from '../utils/scheduleFingerprint';
import { buildValidMatches, computeLiveMatches, isNewScheduledMatch, type ValidMatchEntry } from './engineMatchModel';

// P8 (Fixrunde 3, W11): Bestandsschutz -- `buildValidMatches`/`isNewScheduledMatch`/
// `computeLiveMatches`/`ValidMatchEntry` sind nach `./engineMatchModel` ausgelagert (reine
// Klassifizierungslogik, kein React). Re-Export hier, damit bestehende Importe (z. B.
// `useEngineCommandWiring.ts`) unveraendert bleiben.
export { buildValidMatches, isNewScheduledMatch, computeLiveMatches };
export type { ValidMatchEntry };

export interface UseEngineMatchesResult {
  /** Nur Engine-Spiele (B1) -- Altspiele fehlen hier bewusst, ihr Pfad bleibt unveraendert. */
  liveMatches: Map<string, LiveMatch>;
  isEngineMatch: (matchId: string) => boolean;
}

/**
 * Nicht-UUID-Spiel-IDs (Recherche Fixrunde 2): heutige Generatoren (`fairScheduler`,
 * `playoffScheduler`) liefern durchgehend UUIDs (`crypto.randomUUID()`); `matches.id` ist in der
 * Datenbank als `uuid` typisiert, `match_events.match_id` ebenso per Fremdschluessel. `Match.id`
 * ist aber im TS-Typ ein einfacher `string` ohne Kompilierzeit-Garantie (z. B. Gast-/lokale
 * Turniere ohne Server-Anbindung koennten theoretisch andere IDs vergeben). Die Sammelabfrage
 * (`fetchEngineMatchIds`) darf an einer einzelnen Nicht-UUID-ID nicht fuer das GESAMTE Turnier
 * scheitern (eine ungueltige `uuid`-Eingabe wirft in Postgres, nicht nur fuer diese eine Zeile) --
 * deshalb werden Nicht-UUID-IDs schon hier herausgefiltert, bevor sie die Abfrage erreichen. Sie
 * koennen ohnehin keine Server-Engine-Ereignisse haben (die FK-Spalte ist `uuid`).
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(matchId: string): boolean {
  return UUID_PATTERN.test(matchId);
}

interface LiveMatchesCache {
  validMatches: ValidMatchEntry[];
  engineMatchIds: Set<string>;
  tournament: Tournament;
  context: MatchEngineContextValue | null;
  localLiveMatches: Map<string, LiveMatch>;
  dirty: boolean;
  map: Map<string, LiveMatch>;
}

/**
 * C1-Fix (b): liefert bei unveraendertem Inhalt zwingend dieselbe Map-Referenz wie zuvor --
 * mindestens eine stabile leere Map fuer ein reines Altturnier. Jede `engine.notify()` (z. B. durch
 * `ensureMatch` eines ALTSPIELS ohne jede Engine-Relevanz) darf sonst eine neue, aber inhaltlich
 * gleiche Map erzeugen; jeder Aufrufer, der diese Map in einer Abhaengigkeitsliste fuehrt (z. B. der
 * Lade-Effekt in `useMatchExecution`), haelt dann NIE an (Review C1).
 */
function liveMatchEquals(a: LiveMatch, b: LiveMatch): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function stableLiveMatches(previous: Map<string, LiveMatch> | null, next: Map<string, LiveMatch>): Map<string, LiveMatch> {
  if (previous?.size === next.size) {
    let identical = true;
    for (const [id, match] of next) {
      const before = previous.get(id);
      if (!before || !liveMatchEquals(before, match)) {
        identical = false;
        break;
      }
    }
    if (identical) {
      return previous;
    }
  }
  return next;
}

export function useEngineMatches(
  tournament: Tournament,
  enabled: boolean,
  localLiveMatches: Map<string, LiveMatch>,
): UseEngineMatchesResult {
  const context = useMatchEngineContextOptional();
  const [engineMatchIds, setEngineMatchIds] = useState<Set<string>>(new Set());
  // N-m5: Lesezugriff fuer den Fehlerfall der Sammelabfrage OHNE `engineMatchIds` als
  // Effekt-Abhaengigkeit -- das wuerde bei jedem `setEngineMatchIds`-Aufruf den ganzen
  // `ensureMatch`/Sammelabfrage-Lauf erneut anstossen (ein C1-artiges Muster).
  const engineMatchIdsRef = useRef(engineMatchIds);
  engineMatchIdsRef.current = engineMatchIds;

  const validMatches = useMemo(() => buildValidMatches(tournament), [tournament]);
  // I2 (C3a-2a Fixrunde 1): der Effekt unten (ensureMatch/Sammelabfrage/catchUpLoaded) darf NICHT
  // bei jeder Overlay-Aenderung erneut laufen (W3-Verstoss: IDB-Schreibzugriffe + Netzaufruf bei
  // jeder Stand-/Statusaenderung eines bereits geladenen Engine-Spiels). `validMatchesRef` liefert
  // dem Effekt trotzdem immer den AKTUELLEN Wert (synchron vor dem Effekt-Lauf gesetzt), die
  // Abhaengigkeitsliste selbst haengt an `scheduleFingerprint` (Spielplan-Inhalt, ohne Ergebnis-/
  // Statusfelder).
  const validMatchesRef = useRef(validMatches);
  validMatchesRef.current = validMatches;
  const scheduleKey = scheduleFingerprint(tournament);

  useEffect(() => {
    if (!context) {
      return undefined;
    }
    const { engine } = context;
    let cancelled = false;
    async function run(): Promise<void> {
      for (const entry of validMatchesRef.current) {
        await engine.ensureMatch(entry.matchId, entry.ctx, tournament.id);
      }
      if (cancelled || !enabled || !isSupabaseConfigured || !supabase) {
        return;
      }
      // N-m5: bei einem Fehler bleibt `ids` `null` -- das VORHERIGE gute Ergebnis (`engineMatchIds`
      // aus dem umgebenden Render) bleibt dann in Kraft, statt auf eine leere Menge zurueckzufallen
      // (ein kurzer Netzfehler wuerde sonst ein bereits bekanntes Server-Engine-Spiel voruebergehend
      // auf den Altpfad zurueckschalten).
      let ids: Set<string> | null = null;
      try {
        // K8: derselbe Deep-Instantiation-Umweg wie im MatchEngineProvider (TS2589).
        const client: unknown = supabase;
        ids = await fetchEngineMatchIds(
          client as EngineMatchIdsQueryClient,
          validMatchesRef.current.map((entry) => entry.matchId).filter(isUuid),
        );
      } catch {
        // W3 ist ein Optimierungspfad: bei Fehler zaehlen weiterhin lokale Kopien mit Ereignissen.
      }
      if (cancelled) {
        return;
      }
      if (ids) {
        setEngineMatchIds(ids);
      }
      // I1/W3: `catchUp` laeuft NICHT mehr je `ensureMatch`, sondern genau einmal hier -- nur fuer
      // Spiele, die die Sammelabfrage als Engine-Spiel meldet oder die schon offene eigene
      // Eintraege haben (`catchUpLoaded` entscheidet je Spiel, s. `qualifiesForCatchUp`).
      engine.markEngineMatches(ids ?? engineMatchIdsRef.current);
      await engine.catchUpLoaded();
    }
    // m2: `run()` kann werfen (z. B. `requireAccount()` vor `start()`, wenn dieser Kind-Effekt vor
    // dem Provider-Effekt laeuft) -- ohne `catch` waere das eine unbehandelte Ablehnung.
    run().catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // m3: `context?.accountId` steht zusaetzlich zu `context` in der Abhaengigkeitsliste -- der
    // Provider gibt zwar bereits ein neues `context`-Objekt je Kontowechsel aus, die explizite
    // Nennung dokumentiert den eigentlichen Ausloeser (Kontowechsel -> Kopien-Cache neu aufbauen).
    // I2: `scheduleKey` statt `validMatches` -- s. Kommentar an dessen Definition.
  }, [scheduleKey, context, context?.accountId, enabled, tournament.id]);

  // `useSyncExternalStore` statt `useMemo` + Zaehler-State: die Engine mutiert AUSSERHALB von
  // React (IndexedDB/Netz), `getSnapshot` muss deshalb bei unveraendertem Inhalt zwingend dieselbe
  // Map-Referenz liefern (sonst haelt jeder Aufrufer, der `liveMatches` in einer
  // Abhaengigkeitsliste fuehrt, nie an -- exakt das Muster aus `useOutboxStatus`).
  const cacheRef = useRef<LiveMatchesCache | null>(null);
  const getSnapshot = useCallback((): Map<string, LiveMatch> => {
    const cache = cacheRef.current;
    const unchanged =
      cache &&
      !cache.dirty &&
      cache.validMatches === validMatches &&
      cache.engineMatchIds === engineMatchIds &&
      cache.tournament === tournament &&
      cache.context === context &&
      cache.localLiveMatches === localLiveMatches;
    if (unchanged) {
      return cache.map;
    }
    const computed = computeLiveMatches(context, validMatches, engineMatchIds, tournament, localLiveMatches);
    const map = stableLiveMatches(cache?.map ?? null, computed);
    cacheRef.current = { validMatches, engineMatchIds, tournament, context, localLiveMatches, dirty: false, map };
    return map;
  }, [validMatches, engineMatchIds, tournament, context, localLiveMatches]);
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
  const liveMatches = useSyncExternalStore(subscribe, getSnapshot);

  return {
    liveMatches,
    isEngineMatch: (matchId: string) => liveMatches.has(matchId),
  };
}
