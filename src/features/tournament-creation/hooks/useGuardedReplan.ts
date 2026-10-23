/**
 * useGuardedReplan (A-08f3e4 Fixrunde 1, I-1): Neuplanung eines bestehenden Turniers im Assistenten nur, wenn kein Spiel
 * Einträge hat (@FU-090 Beispiel „im Assistenten den Spielplan neu erzeugen“). Sonst Hinweis „Spiel 7 hat Einträge – nur über
 * Spielplan auf Anfang setzen“ (`useMatchEntryGuard`). Auch ein abgesetztes Spiel (ein SKIP) hat Einträge – der Anpfiff-Zustand
 * der Neuplanung zählt es als „nicht angepfiffen“, ohne diese Sperre entstünden Geisterspiele (M5).
 */
import { useCallback } from 'react';
import type { Tournament } from '../../../types/tournament';
import type { MatchStartState } from '../../../utils/matchStartState';
import { useMatchEntryGuard } from '../../../hooks/useMatchEntryGuard';
import { openReplan, type ReplanSession } from '../utils/replan';

export function useGuardedReplan(onOpen: (session: ReplanSession) => void) {
  const entryGuard = useMatchEntryGuard();
  return useCallback((current: Tournament, updated: Tournament, startState: MatchStartState) => {
    void entryGuard.blocks(current).then((blocked) => {
      if (!blocked) { onOpen(openReplan(current, updated, startState)); }
    });
  }, [entryGuard, onOpen]);
}
