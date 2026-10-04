/**
 * useTournamentStartState — Anpfiff-Zustand eines Turniers für die
 * destruktiven Sperren (@LZ-003): „Turnier löschen", „Im Wizard bearbeiten",
 * Papierkorb.
 *
 * Liefert das Ergebnis der GEMEINSAMEN Funktion `getMatchStartState`
 * (utils/matchStartState.ts) und speist sie mit dem Live-Stand ein, den die App
 * schon für das Cockpit liest: `ILiveMatchRepository.getAll` — derselbe Service,
 * den `useMatchExecution` (Cockpit) liest. Keine eigene Live-Engine.
 *
 * Ohne RepositoryProvider im Baum (isolierte Komponenten-Tests, rein lokale
 * Nutzung ohne Cloud-Synchronisierung) gibt es keine Live-Quelle; dann entscheidet
 * die lokale Match-Liste allein (Ruling W1: „Eine lokale Kopie allein gilt nur
 * dann als ausreichend, wenn das Turnier rein lokal ist").
 *
 * Lässt sich der Live-Stand nicht lesen (Fehler/Offline) oder noch nicht laden,
 * ist der Zustand „nicht feststellbar" — die Aktion wird nicht angeboten
 * (fail-closed, Ruling W1).
 */
import { useEffect, useState } from 'react';
import type { Tournament } from '../types/tournament';
import { useOptionalLiveMatchRepository } from '../core/contexts/RepositoryContext';
import { useIsRealtimeEnabled } from '../lib/realtimeEnabled';
import { useIsOnline } from './useOnlineStatus';
import {
  getMatchStartState,
  type LiveStartSignal,
  type MatchStartState,
} from '../utils/matchStartState';

export interface UseTournamentStartStateOptions {
  /**
   * Ist die destruktive Aktion überhaupt vorgesehen? Ohne Aktion wird der
   * Live-Stand NICHT gelesen (B-01a Fixrunde 2, P1): eine Server-Abfrage, die
   * das Ergebnis nicht ändern kann, wird gespart.
   */
  enabled?: boolean;
}

export function useTournamentStartState(
  tournament: Pick<Tournament, 'id' | 'matches' | 'status' | 'publishedAt'>,
  options?: UseTournamentStartStateOptions
): MatchStartState {
  const enabled = options?.enabled ?? true;
  const liveRepository = useOptionalLiveMatchRepository();
  const isRealtimeEnabled = useIsRealtimeEnabled();
  const isOnline = useIsOnline();

  // P2: Im Cloud-Modus ist der Live-Stand offline nicht lesbar — der Zustand
  // ist dann „nicht feststellbar" (fail-closed), die Aktion wird nicht
  // angeboten. Rein lokal entscheidet die Match-Liste allein (W1).
  const offlineInCloud = isRealtimeEnabled && !isOnline;

  // U0 (F1): „festgelegt" = veröffentlicht (status ODER der monotone Freigabe-
  // Marker publishedAt — „Im Wizard bearbeiten" setzt transient auf 'draft' zurück).
  const isEstablished = tournament.status === 'published' || tournament.publishedAt !== undefined;

  // P1: Live-Abfrage nur, wenn sie das Ergebnis ändern kann: die Aktion ist
  // vorgesehen (enabled), der Grundzustand aus den Spielen ist 'not-started'
  // (nur dann kann der Live-Stand noch 'started' beweisen) und es sind Spiele
  // geladen (matches.length > 0).
  const fromMatches = getMatchStartState(tournament.matches, undefined, isEstablished);
  const hasMatches = (tournament.matches?.length ?? 0) > 0;
  const needsLive = enabled && fromMatches === 'not-started' && hasMatches;
  const [live, setLive] = useState<LiveStartSignal>(undefined);

  useEffect(() => {
    if (!needsLive || offlineInCloud || !liveRepository || !tournament.id) {
      return;
    }
    let cancelled = false;
    setLive({ status: 'loading' });
    liveRepository
      .getAll(tournament.id)
      .then((map) => {
        if (cancelled) {
          return;
        }
        let anyStarted = false;
        map.forEach((match) => {
          // NOT_STARTED zählt nicht; RUNNING/PAUSED/FINISHED sind der Beweis,
          // dass seit dem Festlegen angepfiffen wurde (W1: laufend/pausiert —
          // 'finished' aus dem Live-Repo mitgezählt, weil eine lokale
          // tournament.matches-Kopie veraltet sein kann und ein beendetes Live-Spiel
          // zwingend angepfiffen wurde).
          if (match.status !== 'NOT_STARTED') {
            anyStarted = true;
          }
        });
        setLive({ status: 'ok', anyStarted });
      })
      .catch(() => {
        if (!cancelled) {
          setLive({ status: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [needsLive, offlineInCloud, liveRepository, tournament.id]);

  // P2: Offline im Cloud-Modus ist der Live-Stand nicht lesbar → 'error'
  // (nicht feststellbar). Ohne Bedarf für den Live-Stand entscheidet die
  // lokale Match-Liste allein; mit Bedarf gilt 'loading', bis die Abfrage
  // steht (fail-closed).
  const signal: LiveStartSignal = offlineInCloud
    ? { status: 'error' }
    : needsLive && liveRepository
      ? (live ?? { status: 'loading' })
      : undefined;
  return getMatchStartState(tournament.matches, signal, isEstablished);
}
