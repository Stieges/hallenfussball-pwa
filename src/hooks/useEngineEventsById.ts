/**
 * useEngineEventsById (C3b-2b, §8 Nr. 12): nicht zurückgenommene Engine-Ereignisse je Spiel
 * (Spiel-ID → Events) für Torschützenliste/Fair-Play/Export. Quelle framework-frei in
 * `src/core` (`toRuntimeEvents` via `toLiveMatchView`); kein Schreiben in `Match.events`, kein
 * `syncUp`. Nur Spiele mit Ereignissen -- ein leeres Array darf `match.events` nicht verdrängen.
 */
import { useMemo } from 'react';
import type { LiveMatch } from '../core/models/LiveMatch';
import type { RuntimeMatchEvent, Tournament } from '../types/tournament';
import { useEngineMatches } from './useEngineMatches';

export function useEngineEventsById(
  tournament: Tournament,
): ReadonlyMap<string, RuntimeMatchEvent[]> {
  const noLocalLiveMatches = useMemo(() => new Map<string, LiveMatch>(), []);
  const { liveMatches } = useEngineMatches(tournament, true, noLocalLiveMatches);
  return useMemo(() => {
    const map = new Map<string, RuntimeMatchEvent[]>();
    for (const [matchId, match] of liveMatches) {
      if (match.events.length > 0) {
        map.set(matchId, match.events);
      }
    }
    return map;
  }, [liveMatches]);
}
