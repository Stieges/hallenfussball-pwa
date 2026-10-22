/**
 * useVerbinden – „Verbinden“ ohne Netz (A-06h, @SL-168): erneut anmelden und die wartenden Einträge sofort übertragen.
 * Eine Quelle für den Offline-Hinweis der App und den schmalen Kopf im Cockpit.
 */
import { useCallback } from 'react';
import { useAuth } from '../auth/hooks/useAuth';
import { useResyncNow } from './useResyncNow';

export function useVerbinden(): () => void {
  const { reconnect } = useAuth();
  const resyncNow = useResyncNow();
  return useCallback(() => {
    void reconnect();
    void resyncNow();
  }, [reconnect, resyncNow]);
}
