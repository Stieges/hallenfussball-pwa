/**
 * useMonitorFinalStandings (R3-7; @LZ-076, @LZ-077, @ZM-012, @ET-045, @ZM-180, @ZM-121 Z. 1/2): der beim Abschluss gespeicherte Endstand
 * für den Monitor, gelesen über seinen Link `display_final_standings(tournament_id, monitor_id)` (Migration 20261118_008: gleiche Prüfung
 * wie `display_tournament`, also auch ohne Online-Teilen) – nie aus der Live-Tabelle, nie selbst gerechnet.
 *
 * Wann gefragt wird (`ask`):
 * - `finished` (abgeschlossen): sofort, danach alle 2 Sekunden, bis der Server den Endstand meldet, dann alle 10 Sekunden (der
 *   Torschützen-Schalter bleibt nach dem Abschluss änderbar).
 * - `open` (nicht abgeschlossen): beim Öffnen, bei Rückkehr in den Vordergrund und bei Netz – ein wieder geöffnetes Turnier (@LZ-091)
 *   hat beim Server weiter seinen Endstand von vorher (@ZM-121 Z. 2); nur dann wird im 10-Sekunden-Takt nachgefragt. Kein Takt während
 *   eines normal laufenden Turniers.
 * - `off` (Kindermodus, Turnier nur auf diesem Gerät): nie; kein Endstand.
 * Jeder Wechsel von `ask` (Abschluss, Wiederöffnen) fragt sofort nach. Eine Störung oder eine unlesbare Antwort lässt den letzten Stand
 * stehen: „nicht erreichbar“ ist nie „kein Endstand“ (@ZM-109, @ZM-180). Nur eine echte Antwort `none` nimmt ihn weg.
 */
import { useCallback, useEffect, useState } from 'react';
import { parsePublicFinalStandings, type PublicFinalStandings } from '../../core/repositories/publicFinalStandings';
import { supabase } from '../../lib/supabase';
import { usePolling } from '../public-view/usePolling';
import { withTimeout } from '../public-view/withTimeout';

export type DisplayFinalStandingsRead = (tournamentId: string, monitorId: string) => Promise<unknown>;
export type FinalStandingsAsk = 'off' | 'finished' | 'open';

/** Takt, solange der Server nach dem Abschluss noch keinen Endstand meldet (der Abschluss ist gerade erst geschehen). */
export const FINAL_WAIT_POLL_MS = 2_000;
/** Takt, wenn der Endstand steht (Schalter nach dem Abschluss änderbar; wieder geöffnet bis zum neuen Abschluss). */
export const FINAL_HELD_POLL_MS = 10_000;
const FETCH_TIMEOUT_MS = 4_000;

const NONE: PublicFinalStandings = { status: 'none' };

/** Aufruf über den Supabase-Client; ohne Supabase (Turnier nur auf diesem Gerät) gibt es nie einen Endstand des Servers. */
export const readDisplayFinalStandings: DisplayFinalStandingsRead = async (tournamentId, monitorId) => {
  if (supabase === null) {
    return NONE;
  }
  const { data, error } = await supabase.rpc('display_final_standings', { p_tournament_id: tournamentId, p_monitor_id: monitorId });
  if (error !== null) {
    throw new Error(error.message);
  }
  return data;
};

function pollInterval(ask: FinalStandingsAsk, held: boolean): number | null {
  if (held) { return FINAL_HELD_POLL_MS; }
  return ask === 'finished' ? FINAL_WAIT_POLL_MS : null;
}

export function useMonitorFinalStandings(
  tournamentId: string, monitorId: string, ask: FinalStandingsAsk, read: DisplayFinalStandingsRead = readDisplayFinalStandings,
): PublicFinalStandings {
  const [state, setState] = useState<PublicFinalStandings>(NONE);
  const enabled = ask !== 'off';
  const task = useCallback(async (): Promise<void> => {
    try {
      const parsed = parsePublicFinalStandings(await withTimeout(read(tournamentId, monitorId), FETCH_TIMEOUT_MS));
      if (parsed !== null) {
        setState(parsed);
      }
    } catch {
      // Störung: letzter Stand bleibt
    }
  }, [read, tournamentId, monitorId]);
  useEffect(() => {
    if (!enabled) {
      setState(NONE);
    }
  }, [enabled, tournamentId, monitorId]);
  const { pollNow } = usePolling({ task, intervalMs: pollInterval(ask, state.status === 'final'), enabled });
  // Abschluss oder Wiederöffnen: sofort nachfragen, nicht erst im Takt (@LZ-077: ≤ 10 s). Läuft schon ein Abruf, gilt dessen Ergebnis.
  useEffect(() => {
    if (ask !== 'off') {
      void pollNow();
    }
  }, [ask, pollNow]);
  return enabled ? state : NONE;
}
