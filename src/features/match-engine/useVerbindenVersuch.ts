/**
 * useVerbindenVersuch – „Verbinden“ mit sichtbarem Versuch (@SL-168): wie `useVerbinden` (erneut anmelden, wartende Einträge sofort
 * übertragen), meldet aber `laeuft`, solange der Versuch dauert – mindestens `MINDESTDAUER_MS`, damit „Verbinde …“ auch bei einem
 * sofort gescheiterten Versuch lesbar bleibt. Ein zweites Tippen während des Versuchs startet keinen zweiten. Der Ausgang (geklappt
 * oder nicht) steht danach im Netzstatus des Aufrufers, nicht hier.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/hooks/useAuth';
import { useResyncNow } from './useResyncNow';

export const MINDESTDAUER_MS = 1200;

export function useVerbindenVersuch(): { verbinde: () => void; laeuft: boolean } {
  const { reconnect } = useAuth();
  const resyncNow = useResyncNow();
  const [laeuft, setLaeuft] = useState(false);
  const aktiv = useRef(false);
  const lebt = useRef(true);
  useEffect(() => {
    lebt.current = true;
    return () => { lebt.current = false; };
  }, []);
  const verbinde = useCallback(() => {
    if (aktiv.current) { return; }
    aktiv.current = true;
    setLaeuft(true);
    const mindestens = new Promise<void>((fertig) => { setTimeout(fertig, MINDESTDAUER_MS); });
    void Promise.allSettled([Promise.resolve().then(() => reconnect()), resyncNow(), mindestens]).then(() => {
      aktiv.current = false;
      if (lebt.current) { setLaeuft(false); }
    });
  }, [reconnect, resyncNow]);
  return { verbinde, laeuft };
}
