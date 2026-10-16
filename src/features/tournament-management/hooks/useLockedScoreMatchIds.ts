/**
 * A-08f3a2 (Plan `task-A-08f3-plan.md` v4, M1): Spiele, deren Spielstand die Schnelleingabe nicht schreiben darf.
 * Vereinigung aus Engine-Überlagerung (P4) und server-geführten Spielen (Revision > 1). Nach dem Feldweg
 * steht ein fremdes Engine-Spiel lokal als „läuft 1:0“; ohne die zweite Menge wäre es nicht mehr gesperrt.
 * Keine neue Sperre: Dieselben Spiele sind heute gesperrt. Rückbau in e2.
 */
import { useRef, type RefObject } from 'react';
import type { Tournament } from '../../../types/tournament';
import { useEngineOverlaidMatchIds } from '../../../hooks/useEngineOverlayForTournament';
import { useServerLedMatchIds } from '../../../hooks/useServerLedMatchIds';

export function useLockedScoreMatchIds(tournament: Tournament): RefObject<ReadonlySet<string>> {
  const overlaidRef = useEngineOverlaidMatchIds(tournament);
  const serverLed = useServerLedMatchIds(tournament.id);
  const ref = useRef<ReadonlySet<string>>(new Set());
  ref.current = new Set([...overlaidRef.current, ...serverLed]);
  return ref;
}
