/**
 * „Nach dem Ende eingetroffen“ lesen (nur Turnierleitung, nur abgeschlossene Turniere mit Konto): einmal beim Öffnen, danach alle
 * 30 s bei sichtbarer Seite und bei Netz. Ein Lesefehler behält den letzten Stand und meldet „nicht lesbar“ (nichts verschwindet still).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { readLateEntries, type LateEntry } from '../../../core/repositories/lateEntriesRead';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { useIsOnline } from '../../../hooks/useOnlineStatus';

export const LATE_ENTRIES_POLL_MS = 30_000;

export interface LateEntriesState {
  status: 'loading' | 'ready' | 'unavailable';
  entries: LateEntry[];
}

export function useLateEntries(tournamentId: string, enabled: boolean): LateEntriesState {
  const online = useIsOnline();
  const [state, setState] = useState<LateEntriesState>({ status: 'loading', entries: [] });
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    if (!enabled || !online) {
      return;
    }
    const result = await readLateEntries(isSupabaseConfigured ? supabase : null, tournamentId);
    if (!alive.current) {
      return;
    }
    setState((previous) => (result.ok ? { status: 'ready', entries: result.entries } : { status: 'unavailable', entries: previous.entries }));
  }, [enabled, online, tournamentId]);

  useEffect(() => {
    alive.current = true;
    if (!enabled) {
      return () => { alive.current = false; };
    }
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') { void refresh(); } }, LATE_ENTRIES_POLL_MS);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, [enabled, refresh]);
  return state;
}
