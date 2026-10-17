/**
 * useResultEntryAck (A-08f3e2, H-2; Fixrunde 1 I-1): merkt einen Spielplan-Eintrag für die K.-o.-Auflösung nach
 * der Bestätigung durch den Server vor (`koResolutionQueue`). Aufgelöst wird in `useKoResolutionAfterAck`
 * (`useTournamentManager`, unabhängig vom Spielplan-Tab). Offline und K.-o.-relevant: Hinweis `schedule.koAfterSend`.
 */
import { useCallback, useRef } from 'react';
import type { Tournament } from '../../../types/tournament';
import type { MatchEngineContextValue } from '../../match-engine/matchEngineContextInstance';
import type { ValidMatchEntry } from '../../../hooks/engineMatchModel';
import { enqueueKo } from '../../../hooks/koResolutionQueue';
import { slotUpdatesAfterResult, withEngineResult } from '../../../hooks/koSlotResolution';

export interface UseResultEntryAckOptions {
  context: MatchEngineContextValue | null;
  tournament: Tournament;
  onKoAfterSend: () => void;
}

export function useResultEntryAck({ context, tournament, onKoAfterSend }: UseResultEntryAckOptions) {
  const tournamentRef = useRef(tournament);
  tournamentRef.current = tournament;

  return useCallback(
    (eventId: string, entry: ValidMatchEntry) => {
      if (!context) {
        return;
      }
      const current = tournamentRef.current;
      const offline = context.accountId !== 'guest' && typeof navigator !== 'undefined' && !navigator.onLine;
      if (offline && slotUpdatesAfterResult(withEngineResult(current, entry, context.engine.view(entry.matchId))).length > 0) {
        onKoAfterSend();
      }
      enqueueKo(current.id, { eventId, matchId: entry.matchId });
    },
    [context, onKoAfterSend],
  );
}
