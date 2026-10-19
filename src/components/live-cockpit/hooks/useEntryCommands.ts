/**
 * useEntryCommands – die Befehle der Eintrags-Abläufe (`EntryCommands`) aus den `on…`-Rückrufen des Aufrufers (Aufgabe 3.4).
 *
 * Tor liefert die Ereignis-ID (B-07), damit die Nummer als Nachtrag an dasselbe Tor geht. Das Eigentor nimmt das gezählte Tor
 * zurück und erfasst OWN_GOAL für den Gegner mit der Spielzeit des ersten Tipps (@SL-022). Dosierte Wege für Foul, Karte und
 * Zeitstrafe: Dauer der Zeitstrafe setzt die Engine aus der Regel (@SL-029).
 */
import { useMemo } from 'react';
import type { LiveCockpitProps } from '../types';
import type { FreshEntryCommands } from './useFreshEntryCommands';
import type { EntryCommands } from './useEntryFlows';

export function useEntryCommands(
  props: Pick<LiveCockpitProps, 'currentMatch' | 'onGoal' | 'onFoul' | 'onCard' | 'onTimePenalty'>,
  frisch: FreshEntryCommands,
): EntryCommands {
  const matchId = props.currentMatch?.id;
  const { onGoal, onFoul, onCard, onTimePenalty } = props;
  return useMemo((): EntryCommands => {
    const id = matchId ?? '';
    const tor = async (teamId: string, options?: Parameters<LiveCockpitProps['onGoal']>[3]): Promise<string | null> =>
      (await onGoal(id, teamId, 1, options)) ?? null;
    return {
      tor: (teamId) => tor(teamId),
      nummer: frisch.nummer,
      eigentor: async ({ torEventId, gegnerTeamId, clockMs }) => {
        await frisch.zuruecknehmen(torEventId);
        return tor(gegnerTeamId, { own: true, clockMs });
      },
      foul: async (teamId) => { onFoul?.(id, teamId); },
      karte: async (teamId, art, { nummer, clockMs }) => { onCard?.(id, teamId, art, { playerNumber: nummer ?? undefined, clockMs }); },
      zeitstrafe: async (teamId, { nummer, clockMs }) => { onTimePenalty?.(id, teamId, { playerNumber: nummer ?? undefined, clockMs }); },
    };
  }, [matchId, onGoal, onFoul, onCard, onTimePenalty, frisch]);
}
