/**
 * usePublicFinalStandings (R3-6; @LZ-074, @LZ-075, @LZ-077, @ZM-011): der gespeicherte Endstand für die Zuschauer-Seite.
 * Im Takt des Spielplans (`usePolling`, 10 Sekunden im Vordergrund) wird nur gefragt, solange das Turnier abgeschlossen ist oder ein
 * Endstand schon da ist (Z20, Qualitätsregel „vor dem Abschluss höchstens eine Server-Funktion je 10 Sekunden“): davor genügt der
 * Spielplan-Abruf, der Endstand wird einmal beim Öffnen und bei Rückkehr in den Vordergrund oder ins Netz erfragt (ein Turnier, das
 * über den Betreiber wieder geöffnet wurde, zeigt ihn so auch beim ersten Öffnen, @LZ-077). Meldet der Spielplan den Abschluss,
 * wird sofort gefragt, also erscheint der Endstand ohne Neuladen nach höchstens einem Takt. Nach dem Wiederöffnen über den Betreiber (@LZ-091) liefert der Server ihn unverändert weiter, bis neu abgeschlossen
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

/** `enabled`: Turnier geladen; `finished`: der Spielplan meldet „abgeschlossen“ (`lifecycleStatus`). */
export function usePublicFinalStandings(
  shareCode: string, enabled: boolean, finished: boolean, read: PublicFinalStandingsRead = readPublicFinalStandings,
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
  const polls = finished || state.status === 'final';
  usePolling({ task, intervalMs: polls ? PUBLIC_POLL_INTERVAL_MS : null, enabled });
  return state;
}
