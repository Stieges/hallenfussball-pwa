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
  matchId: string;
  ctx: MatchContext;
  meta: LiveMatchMeta;
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
    const ctx: MatchContext = { matchId: match.id, teamAId, teamBId };
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
      matchId: match.id,
      ctx,
      meta,
      homeVisual: { logo: homeTeam?.logo, colors: homeTeam?.colors },
      awayVisual: { logo: awayTeam?.logo, colors: awayTeam?.colors },
    });
  }
  return entries;
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
  dirty: boolean;
  map: Map<string, LiveMatch>;
}

function computeLiveMatches(
  context: MatchEngineContextValue | null,
  validMatches: ValidMatchEntry[],
  engineMatchIds: Set<string>,
  tournament: Tournament,
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
    if (!hasLocalEvents && !engineMatchIds.has(entry.matchId)) {
      continue; // B1 (C3a-1, ohne "scheduled"-Klausel): bleibt Altspiel.
    }
    const rules = view.result.state.rules ?? rulesFor(tournament, undefined);
    const viewClock = { serverNow: engine.serverNow(), offsetMs: clock.offsetMs };
    const meta: LiveMatchMeta = { ...entry.meta, version: view.confirmedCount };
    const state = view.result.state.rules ? view.result.state : { ...view.result.state, rules };
    const liveMatch = toLiveMatchView(state, meta, viewClock, view.log);
    // W5: Teamfarben/-logo traegt der Hook nach (Adapter kennt nur id/name).
    map.set(entry.matchId, {
      ...liveMatch,
      homeTeam: { ...liveMatch.homeTeam, ...entry.homeVisual },
      awayTeam: { ...liveMatch.awayTeam, ...entry.awayVisual },
    });
  }
  return map;
}

export function useEngineMatches(tournament: Tournament, enabled: boolean): UseEngineMatchesResult {
  const context = useMatchEngineContextOptional();
  const [engineMatchIds, setEngineMatchIds] = useState<Set<string>>(new Set());

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
      try {
        // K8: derselbe Deep-Instantiation-Umweg wie im MatchEngineProvider (TS2589).
        const client: unknown = supabase;
        const ids = await fetchEngineMatchIds(
          client as EngineMatchIdsQueryClient,
          validMatches.map((entry) => entry.matchId),
        );
        if (!cancelled) {
          setEngineMatchIds(ids);
        }
      } catch {
        // W3 ist ein Optimierungspfad: bei Fehler zaehlen weiterhin lokale Kopien mit Ereignissen.
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [validMatches, context, enabled, tournament.id]);

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
      cache.context === context;
    if (unchanged) {
      return cache.map;
    }
    const map = computeLiveMatches(context, validMatches, engineMatchIds, tournament);
    cacheRef.current = { validMatches, engineMatchIds, tournament, context, dirty: false, map };
    return map;
  }, [validMatches, engineMatchIds, tournament, context]);
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
