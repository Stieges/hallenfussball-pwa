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
import type { Tournament, Team } from '../types/tournament';
import type { LiveMatch } from '../core/models/LiveMatch';
import { serverRules, type MatchContext } from '../core/match';
import { toLiveMatchView, type LiveMatchMeta } from '../core/match/client';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import { fetchEngineMatchIds, type EngineMatchIdsQueryClient } from '../features/match-engine/fetchEngineMatchIds';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface UseEngineMatchesResult {
  /** Nur Engine-Spiele (B1) -- Altspiele fehlen hier bewusst, ihr Pfad bleibt unveraendert. */
  liveMatches: Map<string, LiveMatch>;
  isEngineMatch: (matchId: string) => boolean;
}

interface ValidMatchEntry {
  /** Kleingeschrieben -- Engine-interner Schluessel (Store/`engineMatchIds`, Server-Konvention). */
  matchId: string;
  /** N-m2: die AUSSEN sichtbare ID (Original-Schreibweise aus `tournament.matches[].id`) -- der
   * Schluessel der zurueckgegebenen `liveMatches`-Map. So finden Aufrufer (`useMatchExecution`s
   * B4/B5-Wachen, `getLiveMatchData`, `handleReopenMatch`, ...), die mit `match.id`/`matchData.id`
   * in Original-Schreibweise nachschlagen, den Eintrag auch dann, wenn eine Spiel-ID theoretisch
   * Grossbuchstaben enthaelt (heutige Generatoren liefern durchgehend kleine UUIDs, s. Report). */
  externalId: string;
  ctx: MatchContext;
  meta: LiveMatchMeta;
  /** I6/K3/W5: Phase (`groupStage`/Finalrunde) fuer `serverRules` -- eine Finalrunde hat eine andere
   * Dauer als die Gruppenphase, `undefined` waere immer "Gruppenphase". */
  phase: string | undefined;
  /** B1 (C3a-2a): Turnierkopie-Status (`match.matchStatus`), fehlend zaehlt als `'scheduled'`. */
  matchStatus: string | undefined;
  /** W5: `toLiveMatchView` kennt kein Logo/Farben (Adapter unveraendert) -- der Hook traegt sie nach. */
  homeVisual: { logo?: Team['logo']; colors?: Team['colors'] };
  awayVisual: { logo?: Team['logo']; colors?: Team['colors'] };
}

/** W4: Platzhalter/leere Team-IDs oder gleiche Team-ID auf beiden Seiten -> keine Kopie. */
function isPlaceholderTeamId(teamId: string | undefined, tournament: Tournament): boolean {
  if (!teamId) {
    return true;
  }
  const lowered = teamId.toLowerCase();
  if (lowered === 'tbd' || lowered.trim() === '') {
    return true;
  }
  return !tournament.teams.some((team) => team.id.toLowerCase() === lowered);
}

function buildValidMatches(tournament: Tournament): ValidMatchEntry[] {
  const entries: ValidMatchEntry[] = [];
  for (const match of tournament.matches) {
    const teamAId = match.teamA?.toLowerCase();
    const teamBId = match.teamB?.toLowerCase();
    if (
      teamAId === undefined ||
      teamBId === undefined ||
      teamAId === teamBId ||
      isPlaceholderTeamId(teamAId, tournament) ||
      isPlaceholderTeamId(teamBId, tournament)
    ) {
      continue;
    }
    // m5: der Server liefert `match_id` klein zurueck (uuid als Text) -- die Sammelabfrage
    // (`engineMatchIds`) und die Engine-eigenen Store-Schluessel muessen dieselbe Schreibweise
    // verwenden, sonst greift `engineMatchIds.has(matchId)` bei gross geschriebenen IDs nicht.
    const matchId = match.id.toLowerCase();
    const ctx: MatchContext = { matchId, teamAId, teamBId };
    const homeTeam = tournament.teams.find((team) => team.id.toLowerCase() === teamAId);
    const awayTeam = tournament.teams.find((team) => team.id.toLowerCase() === teamBId);
    const meta: LiveMatchMeta = {
      id: match.id,
      number: match.matchNumber ?? match.round,
      phaseLabel: match.label ?? match.group ?? match.phase ?? '',
      fieldId: `field-${match.field}`,
      scheduledKickoff: (match.scheduledTime ?? new Date()).toISOString(),
      refereeName: match.referee !== undefined ? `SR ${match.referee}` : undefined,
      homeTeam: { id: ctx.teamAId, name: homeTeam?.name ?? match.teamA },
      awayTeam: { id: ctx.teamBId, name: awayTeam?.name ?? match.teamB },
      version: 0,
    };
    entries.push({
      matchId,
      externalId: match.id,
      ctx,
      meta,
      phase: match.phase,
      matchStatus: match.matchStatus,
      homeVisual: { logo: homeTeam?.logo, colors: homeTeam?.colors },
      awayVisual: { logo: awayTeam?.logo, colors: awayTeam?.colors },
    });
  }
  return entries;
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

/** K3: exakte serverRules-Eingabe wie supabaseMappers.ts:616-652. */
function rulesFor(tournament: Tournament, matchPhase: string | undefined) {
  return serverRules({
    durationMinutes: null,
    phase: matchPhase ?? null,
    groupPhaseDuration: tournament.groupPhaseGameDuration,
    finalRoundDuration: tournament.finalRoundGameDuration ?? null,
    config: {
      gamePeriods: tournament.gamePeriods,
      halftimeBreak: tournament.halftimeBreak,
      matchCockpitSettings: tournament.matchCockpitSettings,
    },
    finalsConfig: tournament.finalsConfig ?? null,
  });
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
 * B1 (C3a-2a, Plan-Review PC15a): die "scheduled"-Klausel schaltet die Umschaltung fuer NEUE
 * Spiele scharf -- ein Spiel ohne jedes Ereignis wird Engine-Spiel, wenn die Turnierkopie noch
 * `scheduled` ist (oder das Feld fehlt) UND kein Altspiel schon in Betrieb ist (kein LiveMatch
 * ODER dessen Status noch `NOT_STARTED`). Ein bereits laufendes/pausiertes Altspiel bleibt beim
 * Altpfad, bis es dort beendet ist (Uebergangsschutz aus dem Review).
 */
function isNewScheduledMatch(entry: ValidMatchEntry, localLiveMatches: Map<string, LiveMatch>): boolean {
  const isScheduled = (entry.matchStatus ?? 'scheduled') === 'scheduled';
  if (!isScheduled) {
    return false;
  }
  const oldLiveMatch = localLiveMatches.get(entry.externalId);
  return !oldLiveMatch || oldLiveMatch.status === 'NOT_STARTED';
}

function computeLiveMatches(
  context: MatchEngineContextValue | null,
  validMatches: ValidMatchEntry[],
  engineMatchIds: Set<string>,
  tournament: Tournament,
  localLiveMatches: Map<string, LiveMatch>,
): Map<string, LiveMatch> {
  const map = new Map<string, LiveMatch>();
  if (!context) {
    return map;
  }
  const { engine, clock } = context;
  for (const entry of validMatches) {
    const view = engine.view(entry.matchId);
    if (!view) {
      continue;
    }
    const hasLocalEvents = view.log.length > 0;
    const isEngineByServer = hasLocalEvents || engineMatchIds.has(entry.matchId);
    if (!isEngineByServer && !isNewScheduledMatch(entry, localLiveMatches)) {
      continue; // B1: bleibt Altspiel.
    }
    const rules = view.result.state.rules ?? rulesFor(tournament, entry.phase);
    const viewClock = { serverNow: engine.serverNow(), offsetMs: clock.offsetMs };
    const meta: LiveMatchMeta = { ...entry.meta, version: view.confirmedCount };
    const state = view.result.state.rules ? view.result.state : { ...view.result.state, rules };
    const liveMatch = toLiveMatchView(state, meta, viewClock, view.log);
    // W5: Teamfarben/-logo traegt der Hook nach (Adapter kennt nur id/name).
    map.set(entry.externalId, {
      ...liveMatch,
      homeTeam: { ...liveMatch.homeTeam, ...entry.homeVisual },
      awayTeam: { ...liveMatch.awayTeam, ...entry.awayVisual },
    });
  }
  return map;
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

  useEffect(() => {
    if (!context) {
      return undefined;
    }
    const { engine } = context;
    let cancelled = false;
    async function run(): Promise<void> {
      for (const entry of validMatches) {
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
          validMatches.map((entry) => entry.matchId).filter(isUuid),
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
  }, [validMatches, context, context?.accountId, enabled, tournament.id]);

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
