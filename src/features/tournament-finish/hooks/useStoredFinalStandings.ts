/**
 * Der gespeicherte Endstand des abgeschlossenen Turniers (Zustand C): einmal lesen, sobald das Turnier abgeschlossen ist, und
 * erneut, wenn sich der Abschlusszeitpunkt ändert (neuer Abschluss nach dem Wiederöffnen). Nie eine Neuberechnung (@ET-045).
 */
import { useEffect, useState } from 'react';
import { readStoredFinalStandings, type StoredFinalStandingsResult } from '../../../core/repositories/storedFinalStandingsRead';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';

export type StoredStandingsState = { status: 'loading' } | StoredFinalStandingsResult;

/** Wie `useStoredFinalStandings`, dazu `reload` („Erneut laden“, Review #397 m-1): liest die gespeicherte Zeile noch einmal. */
export function useStoredFinalStandingsReload(
  tournamentId: string, enabled: boolean, finishedAt: string | undefined,
): { state: StoredStandingsState; reload: () => void } {
  const [state, setState] = useState<StoredStandingsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let alive = true;
    setState({ status: 'loading' });
    void readStoredFinalStandings(isSupabaseConfigured ? supabase : null, tournamentId).then((result) => { if (alive) { setState(result); } });
    return () => { alive = false; };
  }, [tournamentId, enabled, finishedAt, attempt]);
  return { state, reload: () => setAttempt((n) => n + 1) };
}

export function useStoredFinalStandings(tournamentId: string, enabled: boolean, finishedAt: string | undefined): StoredStandingsState {
  return useStoredFinalStandingsReload(tournamentId, enabled, finishedAt).state;
}
