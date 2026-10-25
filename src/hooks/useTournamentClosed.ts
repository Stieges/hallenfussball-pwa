/**
 * Ist dieses Turnier abgeschlossen (oder abgebrochen)? (R3-3, @LZ-036) -- für Stellen, die nicht über ein Recht laufen
 * (Wizard-Neuplanung, Felder, Monitor-Editor, Zuschauer-Schalter ...). Rechte fragt die App weiter nur über `useCan`,
 * der schon abgeschlossene Turniere verneint. Der Stand kommt aus `useLifecycleLock` (Server-Zustand, R3-1).
 */
import { useSyncExternalStore } from 'react';
import { isTournamentClosedById, subscribeClosedTournaments } from '../core/services/closedTournaments';

export function useTournamentClosed(tournamentId: string): boolean {
  return useSyncExternalStore(subscribeClosedTournaments, () => isTournamentClosedById(tournamentId));
}
