/**
 * useActivePenalties (C3b-1, Plan §2 Nr. 1 / §8 Zeile 24): lokaler Zeitstrafen-Countdown des
 * Cockpits, aus `LiveCockpit.tsx` ausgelagert.
 *
 * Verknuepfung mit der Engine: `add()` legt einen lokalen Countdown an; taucht danach ein NEUES
 * TIME_PENALTY-Ereignis (gleiches Team/Nummer/Dauer) in den wirksamen Ereignissen auf, wird es mit dem
 * aeltesten unverknuepften Countdown gleicher Art verbunden. Verschwindet ein verknuepftes Ereignis aus
 * den wirksamen Ereignissen (RETRACT/Loeschen; zurueckgenommene stehen nur in `retractedEvents`), endet
 * sein Countdown sofort. Ereignisse, die schon beim Oeffnen des Spiels da waren, werden nie verknuepft
 * (die Anzeige aus dem Engine-Zustand kommt in C3c).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivePenalty } from '../../../types/tournament';

export interface PenaltyEventRef {
  id: string;
  type: string;
  payload: { teamId?: string; playerNumber?: number; penaltyDuration?: number };
}

export interface NewPenalty {
  teamId: string;
  playerNumber?: number;
  durationSeconds: number;
}

interface TrackedPenalty extends ActivePenalty {
  durationSeconds: number;
  linkedEventId?: string;
}

function sameKind(penalty: TrackedPenalty, event: PenaltyEventRef): boolean {
  return (
    penalty.teamId === event.payload.teamId &&
    penalty.playerNumber === event.payload.playerNumber &&
    penalty.durationSeconds === (event.payload.penaltyDuration ?? 120)
  );
}

function penaltyEventsOf(events: readonly PenaltyEventRef[] | undefined): PenaltyEventRef[] {
  return (events ?? []).filter((event) => event.type === 'TIME_PENALTY');
}

export function useActivePenalties(
  matchId: string | undefined,
  matchStatus: string | undefined,
  events: readonly PenaltyEventRef[] | undefined,
) {
  const [penalties, setPenalties] = useState<TrackedPenalty[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const matchRef = useRef<string | undefined>(undefined);

  // Verknuepfen und Beenden zurueckgenommener Strafen bei jeder Aenderung der wirksamen Ereignisse.
  useEffect(() => {
    const current = penaltyEventsOf(events);
    if (matchRef.current !== matchId) {
      matchRef.current = matchId;
      knownIdsRef.current = new Set(current.map((event) => event.id));
      setPenalties([]);
      return;
    }
    const known = knownIdsRef.current;
    const fresh = current.filter((event) => !known.has(event.id));
    knownIdsRef.current = new Set(current.map((event) => event.id));
    const currentIds = knownIdsRef.current;
    setPenalties((prev) => {
      const linked = prev.map((penalty) => ({ ...penalty }));
      for (const event of fresh) {
        const target = linked.find((penalty) => penalty.linkedEventId === undefined && sameKind(penalty, event));
        if (target) {
          target.linkedEventId = event.id;
        }
      }
      const kept = linked.filter((penalty) => penalty.linkedEventId === undefined || currentIds.has(penalty.linkedEventId));
      return kept.length === prev.length && fresh.length === 0 ? prev : kept;
    });
  }, [events, matchId]);

  // BUG-008 / C-1: nur ein Intervall, haengt an Status und "gibt es Strafen".
  const hasPenalties = penalties.length > 0;
  useEffect(() => {
    if (!hasPenalties || matchStatus !== 'RUNNING') {
      return;
    }
    const interval = setInterval(() => {
      setPenalties((prev) =>
        prev
          .map((penalty) => ({ ...penalty, remainingSeconds: Math.max(0, penalty.remainingSeconds - 1) }))
          .filter((penalty) => penalty.remainingSeconds > 0),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [matchStatus, hasPenalties]);

  const add = useCallback((penalty: NewPenalty) => {
    const now = new Date();
    setPenalties((prev) => [
      ...prev,
      {
        eventId: `penalty-${now.getTime()}-${prev.length}`,
        teamId: penalty.teamId,
        playerNumber: penalty.playerNumber,
        durationSeconds: penalty.durationSeconds,
        remainingSeconds: penalty.durationSeconds,
        startedAt: now,
        endsAt: new Date(now.getTime() + penalty.durationSeconds * 1000),
      },
    ]);
  }, []);

  const clear = useCallback(() => setPenalties([]), []);

  return { penalties, add, clear };
}
