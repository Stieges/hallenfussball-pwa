/**
 * useLifecycleLock – Sperre nach dem Turnierabschluss (Plan R3-2b, E10, R-EA-13; Grundlage für die Sperre in der
 * Oberfläche R3-3 und für R4 „Spiel wieder öffnen“). Abgeschlossen oder abgebrochen (`isTournamentClosed`, Zwilling der
 * Server-Sperre `tournament_is_closed`) heißt: kein `save()` mehr. Der Server lehnt jede Änderung ohnehin mit 55000 ab
 * (@LZ-036, @LZ-038); die App schickt sie gar nicht erst – sonst füllte jeder Autosave die Fehlerliste (Plan R6).
 * Öffentliche Ansicht und Torschützen-Schalter laufen über eigene Wege (`make_tournament_private/public`,
 * `updateTournamentMetadata`), nicht über `save()`.
 */
import { useMemo } from 'react';
import type { Tournament } from '../types/tournament';
import { isTournamentClosed } from '../core/services/lifecycle';

type LifecycleFields = Pick<Tournament, 'status' | 'lifecycleStatus'>;

export interface LifecycleLock {
  /** Das Turnier ist abgeschlossen (oder abgebrochen): nichts mehr zu bearbeiten. */
  closed: boolean;
  /** Darf dieses Turnier gespeichert werden? Nein, wenn der bekannte oder der neue Stand abgeschlossen ist. */
  saveAllowed: (next: LifecycleFields) => boolean;
}

export function useLifecycleLock(tournament: LifecycleFields | null): LifecycleLock {
  const closed = tournament !== null && isTournamentClosed(tournament);
  return useMemo(() => ({ closed, saveAllowed: (next: LifecycleFields) => !closed && !isTournamentClosed(next) }), [closed]);
}
