/**
 * useResultEntryEvents (UR, @FU-080): die Direkteinträge (`RESULT_ENTRY`) eines Engine-Spiels für das Protokoll --
 * angenommen und nicht zurückgenommen, in Log-Reihenfolge -- und das Turnier des Spiels aus der lokalen Spielkopie.
 *
 * Eigene Liste neben `LiveMatch.events` (brief-UR.md R-UR-3): `toRuntimeEvents` bleibt unverändert, damit Tor-/
 * Foulzähler, `scoreAfter` und Monitor nicht wandern. Das Turnier steht in der Spielkopie (`ensureMatch(…, tournamentId)`),
 * weil das Cockpit-Protokoll (Sidebar, Ereignisprotokoll) nur die Spiel-ID kennt.
 */
import { useEffect, useState } from 'react';
import type { MatchEngine } from '../../core/match/client';
import { useMatchEngineContextOptional } from './useMatchEngineContext';

export interface ResultEntryEvents {
  tournamentId: string | null;
  ids: string[];
}

const NONE: ResultEntryEvents = { tournamentId: null, ids: [] };

function resultEntryIds(engine: MatchEngine, matchId: string): string[] {
  const view = engine.view(matchId);
  if (!view) {
    return [];
  }
  const { accepted, retracted } = view.result.state;
  const gone = new Set(retracted);
  return view.log
    .filter((event) => event.type === 'RESULT_ENTRY' && accepted[event.id] !== undefined && !gone.has(event.id))
    .map((event) => event.id);
}

const sameIds = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

export function useResultEntryEvents(matchId: string | undefined): ResultEntryEvents {
  const context = useMatchEngineContextOptional();
  const engine = context?.engine ?? null;
  const id = matchId?.toLowerCase() ?? null;
  const [ids, setIds] = useState<string[]>(() => (engine && id ? resultEntryIds(engine, id) : []));
  const [tournamentId, setTournamentId] = useState<string | null>(null);

  useEffect(() => {
    if (!engine || !id) {
      setIds([]);
      return undefined;
    }
    const refresh = (): void => {
      const next = resultEntryIds(engine, id);
      setIds((prev) => (sameIds(prev, next) ? prev : next));
    };
    refresh();
    return engine.subscribe(refresh);
  }, [engine, id]);

  const hasEntries = ids.length > 0;
  useEffect(() => {
    if (!context || !id || !hasEntries) {
      return undefined;
    }
    let cancelled = false;
    context.store.load(context.accountId, id)
      .then((copy) => { if (!cancelled) { setTournamentId(copy?.tournamentId ?? null); } })
      .catch(() => { if (!cancelled) { setTournamentId(null); } });
    return () => { cancelled = true; };
  }, [context, id, hasEntries]);

  return engine && id ? { tournamentId: hasEntries ? tournamentId : null, ids } : NONE;
}
