/**
 * Ein anderes Gerät schließt das Turnier ab: `tournaments` steht nicht in der Realtime-Publikation (A-08f3b2), die Verwaltung erfährt es sonst
 * erst beim nächsten Neuladen (Review #394 H-2, Cloud-E2E N7b). Solange die Verwaltung „Läuft“ zeigt, fragt sie deshalb alle 15 s bei
 * sichtbarer Seite und mit Netz den Zustand beim Server ab (`tournament_lifecycle`, eine kleine Abfrage) und lädt neu, sobald er „abgeschlossen“
 * oder „abgebrochen“ meldet. Keine Antwort (Netz, Fehler) ändert nichts.
 */
import { useEffect, useRef } from 'react';
import { readTournamentLifecycle } from '../../../core/repositories/lifecycleRpc';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { useIsOnline } from '../../../hooks/useOnlineStatus';

export const LIFECYCLE_POLL_MS = 15_000;

export function useServerLifecyclePoll(tournamentId: string, enabled: boolean, onEnded: () => void): void {
  const online = useIsOnline();
  const ended = useRef(onEnded);
  ended.current = onEnded;
  useEffect(() => {
    if (!enabled || !online || !isSupabaseConfigured) {
      return undefined;
    }
    let alive = true;
    const check = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      const lifecycle = await readTournamentLifecycle(supabase, tournamentId);
      if (alive && (lifecycle === 'finished' || lifecycle === 'cancelled')) {
        ended.current();
      }
    };
    const timer = window.setInterval(() => { void check(); }, LIFECYCLE_POLL_MS);
    return () => { alive = false; window.clearInterval(timer); };
  }, [tournamentId, enabled, online]);
}
