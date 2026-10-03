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
import {
  getMatchStartState,
  type LiveStartSignal,
  type MatchStartState,
} from '../utils/matchStartState';

export function useTournamentStartState(
  tournament: Pick<Tournament, 'id' | 'matches' | 'status' | 'publishedAt'>
): MatchStartState {
  const liveRepository = useOptionalLiveMatchRepository();
  const [live, setLive] = useState<LiveStartSignal>(
    liveRepository ? { status: 'loading' } : undefined
  );

  useEffect(() => {
    if (!liveRepository || !tournament.id) {
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
  }, [liveRepository, tournament.id]);

  // U0 (F1): „festgelegt" = veröffentlicht (status ODER der monotone Freigabe-
  // Marker publishedAt — „Im Wizard bearbeiten" setzt transient auf 'draft' zurück).
  const isEstablished = tournament.status === 'published' || tournament.publishedAt !== undefined;
  return getMatchStartState(tournament.matches, live, isEstablished);
}
