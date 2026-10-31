/**
 * usePublicFinalStandings (R3-6; @LZ-074, @LZ-075, @LZ-077, @ZM-011): der gespeicherte Endstand für die Zuschauer-Seite.
 * Gefragt wird im selben Takt wie der Spielplan (`usePolling`, 10 Sekunden im Vordergrund), also erscheint er nach dem Abschluss
 * ohne Neuladen. Nach dem Wiederöffnen über den Betreiber (@LZ-091) liefert der Server ihn unverändert weiter, bis neu abgeschlossen
 * wird (@LZ-077 Z. 2, Migration 20261118_008); er verschwindet nur, wenn der Server `none` meldet (z. B. Teilen zurückgenommen,
 * Kindermodus). Eine Störung lässt den letzten Stand stehen:
 * „nicht erreichbar“ ist nie „kein Endstand“ (@ZM-109).
 */
import { useCallback, useState } from 'react';
import { parsePublicFinalStandings, type PublicFinalStandings } from '../../core/repositories/publicFinalStandings';
import { supabase } from '../../lib/supabase';
import { PUBLIC_POLL_INTERVAL_MS } from './publicSource';
import { usePolling } from './usePolling';
import { withTimeout } from './withTimeout';

export type PublicFinalStandingsRead = (shareCode: string) => Promise<unknown>;

const FETCH_TIMEOUT_MS = 8000;

/** Aufruf über den Supabase-Client; ohne Supabase (Offline-Betrieb) gibt es nie einen öffentlichen Endstand. */
export const readPublicFinalStandings: PublicFinalStandingsRead = async (shareCode) => {
  if (supabase === null) {
    return { status: 'none' };
  }
  const { data, error } = await supabase.rpc('public_final_standings', { p_share_code: shareCode });
  if (error !== null) {
    throw new Error(error.message);
  }
  return data;
};

export function usePublicFinalStandings(
  shareCode: string, enabled: boolean, read: PublicFinalStandingsRead = readPublicFinalStandings,
): PublicFinalStandings {
  const [state, setState] = useState<PublicFinalStandings>({ status: 'none' });
  const task = useCallback(async (): Promise<void> => {
    try {
      const parsed = parsePublicFinalStandings(await withTimeout(read(shareCode), FETCH_TIMEOUT_MS));
      if (parsed !== null) {
        setState(parsed);
      }
    } catch {
      // Störung: letzter Stand bleibt
    }
  }, [read, shareCode]);
  usePolling({ task, intervalMs: PUBLIC_POLL_INTERVAL_MS, enabled });
  return state;
}
