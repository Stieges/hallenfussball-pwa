/**
 * useEventAuthors (UR, Befund C-EREIGNIS-OHNE-URHEBER): Name des Urhebers je Engine-Eintrag eines Spiels.
 *
 * Quellen (brief-UR.md § 6): (a) bestätigte Einträge → Lesefunktion `match_event_author_names` am Server, je Spiel
 * zwischengespeichert und neu geladen, sobald mehr Einträge bestätigt sind; (b) eigene noch nicht bestätigte Einträge
 * (Ausgang) → eigener Name nach derselben Regel wie der Server (Zwilling Z1, `authorNameRule`); (c) ohne
 * `writeMatchData` (Zwilling Z2, @FU-065), als Gast, ohne Netz oder bei Fehler → `null`, ohne Aufruf ohne Recht.
 * Review A1: eigene wartende Einträge brauchen nur die Anmeldung, keine bekannte Rolle (ohne Netz ist sie oft
 * unbekannt); kommt das Netz zurück (`online`), werden die Namen neu geladen.
 * Namen leben nur hier in der Ansicht, nie in `EngineEvent.actorUser` oder im Engine-Zustand (R-UR-2).
 * Szenarien: @FU-080, @FU-082, @FU-065.
 */
import { useCallback, useEffect, useState } from 'react';
import type { MatchEngine } from '../../core/match/client';
import { authorNameRule, readEventAuthorNames, type EventAuthor } from '../../core/repositories/eventAuthorNamesRpc';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/hooks/useAuth';
import { useMyTournamentRole } from '../auth/hooks/useMyTournamentRole';
import { hasPermission } from '../auth/utils/permissions';
import { useMatchEngineContextOptional } from './useMatchEngineContext';

export interface EventAuthors {
  /** Name des Urhebers oder `null` (kein Recht, Gast, unbekannt, ohne Namen). */
  nameOf: (eventId: string) => string | null;
  /** Eigener Name nach derselben Regel (ohne Einladungs-Namen); `null` ohne Anmeldung/Namen (@FU-115: „von …“ nur für andere). */
  ownName: string | null;
}

interface Snapshot {
  confirmedCount: number;
  ownIds: string[];
}

interface CacheEntry {
  confirmedCount: number;
  names: ReadonlyMap<string, EventAuthor>;
}

/** Zwischenspeicher je Konto und Spiel (bleibt über Ummontieren der Protokoll-Zeilen erhalten). */
const cache = new Map<string, CacheEntry>();

/** Nur für Tests. */
export function resetEventAuthorsCache(): void {
  cache.clear();
}

function snapshotOf(engine: MatchEngine, matchId: string): Snapshot {
  const view = engine.view(matchId);
  if (!view) {
    return { confirmedCount: 0, ownIds: [] };
  }
  // log = bestätigte Einträge (nach seq), danach die eigenen offenen/angenommenen Einträge dieses Kontos.
  return { confirmedCount: view.confirmedCount, ownIds: view.log.slice(view.confirmedCount).map((event) => event.id) };
}

const sameSnapshot = (a: Snapshot, b: Snapshot): boolean =>
  a.confirmedCount === b.confirmedCount && a.ownIds.length === b.ownIds.length && a.ownIds.every((id, i) => id === b.ownIds[i]);

export function useEventAuthors(tournamentId: string, matchId: string): EventAuthors {
  const { isAuthenticated, user } = useAuth();
  const { role } = useMyTournamentRole(tournamentId);
  const context = useMatchEngineContextOptional();
  const engine = context?.engine ?? null;
  const accountId = context?.accountId ?? '';
  const id = matchId.toLowerCase();
  const canSee = isAuthenticated && role !== null && hasPermission(role, 'writeMatchData');
  const [onlineTick, setOnlineTick] = useState(0);

  useEffect(() => {
    const onOnline = (): void => { setOnlineTick((tick) => tick + 1); };
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('online', onOnline); };
  }, []);

  const [snapshot, setSnapshot] = useState<Snapshot>(() => (engine ? snapshotOf(engine, id) : { confirmedCount: 0, ownIds: [] }));
  const [names, setNames] = useState<ReadonlyMap<string, EventAuthor>>(() => cache.get(`${accountId}|${id}`)?.names ?? new Map());

  useEffect(() => {
    if (!engine) {
      return undefined;
    }
    const refresh = (): void => {
      const next = snapshotOf(engine, id);
      setSnapshot((prev) => (sameSnapshot(prev, next) ? prev : next));
    };
    refresh();
    return engine.subscribe(refresh);
  }, [engine, id]);

  const { confirmedCount } = snapshot;
  useEffect(() => {
    if (!canSee) {
      return undefined;
    }
    const key = `${accountId}|${id}`;
    const cached = cache.get(key);
    if (cached && cached.confirmedCount >= confirmedCount) {
      setNames(cached.names);
      return undefined;
    }
    let cancelled = false;
    readEventAuthorNames(supabase, id)
      .then((read) => {
        // Leere Antwort (Fehler, ohne Netz) nicht zwischenspeichern -- der nächste Anlass versucht es neu.
        if (read.size > 0) {
          cache.set(key, { confirmedCount, names: read });
        }
        if (!cancelled) { setNames(read); }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [canSee, accountId, id, confirmedCount, onlineTick]);

  const ownName = authorNameRule({ isOwner: role === 'owner', label: null, displayName: user?.name ?? null });
  const { ownIds } = snapshot;
  const nameOf = useCallback((eventId: string): string | null => {
    if (isAuthenticated && ownIds.includes(eventId)) {
      return ownName;
    }
    if (!canSee) {
      return null;
    }
    return names.get(eventId)?.name ?? null;
  }, [isAuthenticated, canSee, ownIds, ownName, names]);

  return { nameOf, ownName: isAuthenticated ? ownName : null };
}
