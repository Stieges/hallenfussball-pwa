/**
 * useMonitorFinalStandings (R3-7; @LZ-076, @LZ-077, @ZM-012, @ET-045, @ZM-180): der beim Abschluss gespeicherte Endstand für den
 * Monitor, gelesen über `display_final_standings(tournament_id)` – nie aus der Live-Tabelle, nie selbst gerechnet.
 *
 * Nur gefragt wird, solange das Turnier abgeschlossen ist (`enabled`): sofort beim Abschluss (der Monitor sieht ihn mit dem
 * Änderungssignal), danach alle 2 Sekunden, bis der Server den Endstand meldet, dann alle 10 Sekunden (der Torschützen-Schalter
 * bleibt nach dem Abschluss änderbar). Eine Störung oder eine unlesbare Antwort lässt den letzten Stand stehen: „nicht erreichbar“
 * ist nie „kein Endstand“ (@ZM-109, @ZM-180). Wird das Turnier wieder geöffnet (`enabled` aus), gilt der Endstand nicht mehr.
 */
import { useCallback, useEffect, useState } from 'react';
import { parsePublicFinalStandings, type PublicFinalStandings } from '../../core/repositories/publicFinalStandings';
import { supabase } from '../../lib/supabase';
import { usePolling } from '../public-view/usePolling';
import { withTimeout } from '../public-view/withTimeout';

export type DisplayFinalStandingsRead = (tournamentId: string) => Promise<unknown>;

/** Takt, solange der Server noch keinen Endstand meldet (der Abschluss ist gerade erst geschehen). */
export const FINAL_WAIT_POLL_MS = 2_000;
/** Takt, wenn der Endstand steht (Schalter nach dem Abschluss änderbar). */
export const FINAL_HELD_POLL_MS = 10_000;
const FETCH_TIMEOUT_MS = 4_000;

const NONE: PublicFinalStandings = { status: 'none' };

/** Aufruf über den Supabase-Client; ohne Supabase (Turnier nur auf diesem Gerät) gibt es nie einen Endstand des Servers. */
export const readDisplayFinalStandings: DisplayFinalStandingsRead = async (tournamentId) => {
  if (supabase === null) {
    return NONE;
  }
  const { data, error } = await supabase.rpc('display_final_standings', { p_tournament_id: tournamentId });
  if (error !== null) {
    throw new Error(error.message);
  }
  return data;
};

export function useMonitorFinalStandings(
  tournamentId: string, enabled: boolean, read: DisplayFinalStandingsRead = readDisplayFinalStandings,
): PublicFinalStandings {
  const [state, setState] = useState<PublicFinalStandings>(NONE);
  const task = useCallback(async (): Promise<void> => {
    try {
      const parsed = parsePublicFinalStandings(await withTimeout(read(tournamentId), FETCH_TIMEOUT_MS));
      if (parsed !== null) {
        setState(parsed);
      }
    } catch {
      // Störung: letzter Stand bleibt
    }
  }, [read, tournamentId]);
  useEffect(() => {
    if (!enabled) {
      setState(NONE);
    }
  }, [enabled, tournamentId]);
  usePolling({ task, intervalMs: state.status === 'final' ? FINAL_HELD_POLL_MS : FINAL_WAIT_POLL_MS, enabled });
  return enabled ? state : NONE;
}
