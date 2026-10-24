/**
 * useJoinRequests – Anfragen und Zugänge der Turnierleitung (A-18a, Plan GA5 R-GA5-6): fragt `list_helper_access` alle 2 s
 * ab, solange die Seite sichtbar ist (Polling statt Realtime), und sofort, wenn die Seite wieder sichtbar wird.
 *
 * Die Liste kommt immer vom Server: nach Zulassen, Ablehnen oder Entziehen ruft die Seite `refresh()`; nichts wird vorab in
 * der App geändert (@HE-047 „nichts vorgemerkt“, Entzug nie nur im Client). Ein Netzfehler behält die letzte Liste und setzt
 * `offline`; 42501 (kein Recht „Helfer verwalten“) beendet das Abfragen und setzt `noRight` (@HE-062).
 *
 * Szenarien: @HE-006 @HE-021 @HE-047 @HE-052 @HE-062 @HE-075 @HE-077 @HE-106.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { callListHelperAccess, type HelperAccessList } from '../../../../core/repositories/helperAccessRpc';
import { captureFeatureError } from '../../../../lib/sentry';
import { supabase } from '../../../../lib/supabase';

export const JOIN_REQUESTS_POLL_MS = 2000;

export type JoinRequestsLoadState = 'loading' | 'ready' | 'noRight' | 'error';

export interface UseJoinRequestsReturn {
  list: HelperAccessList | null;
  loadState: JoinRequestsLoadState;
  /** Der letzte Abruf scheiterte am Netz; die zuletzt bekannte Liste bleibt stehen. */
  offline: boolean;
  refresh: () => Promise<void>;
}

const isVisible = (): boolean => typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function useJoinRequests(tournamentId: string, enabled: boolean): UseJoinRequestsReturn {
  const [list, setList] = useState<HelperAccessList | null>(null);
  const [loadState, setLoadState] = useState<JoinRequestsLoadState>('loading');
  const [offline, setOffline] = useState(false);
  const stopped = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);

  const fetchOnce = useCallback((): Promise<void> => {
    if (inFlight.current) {
      return inFlight.current;
    }
    const run = (async () => {
      const result = await callListHelperAccess(supabase, tournamentId);
      if (stopped.current) {
        return;
      }
      if (result.ok) {
        setList(result.data);
        setLoadState('ready');
        setOffline(false);
        return;
      }
      switch (result.error.kind) {
        case 'network':
          setOffline(true);
          break;
        case 'notAuthorized':
          setLoadState('noRight');
          setOffline(false);
          break;
        default:
          captureFeatureError(new Error(`list_helper_access: ${result.error.kind}`), 'helpers', 'list');
          setLoadState((state) => (state === 'ready' ? state : 'error'));
      }
    })().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = run;
    return run;
  }, [tournamentId]);

  // Ohne Recht fragt die Seite nicht weiter (der Server antwortet jedes Mal mit 42501).
  const blocked = loadState === 'noRight';

  useEffect(() => {
    if (!enabled || blocked) {
      return undefined;
    }
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (isVisible()) {
        await fetchOnce();
      }
      if (!stopped.current) {
        timer = setTimeout(() => {
          void tick();
        }, JOIN_REQUESTS_POLL_MS);
      }
    };
    const onVisible = () => {
      if (isVisible() && !stopped.current) {
        if (timer !== null) {
          clearTimeout(timer);
        }
        void tick();
      }
    };

    void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped.current = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, blocked, fetchOnce]);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      await inFlight.current;
    }
    await fetchOnce();
  }, [fetchOnce]);

  return { list, loadState, offline, refresh };
}
