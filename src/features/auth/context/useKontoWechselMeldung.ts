/**
 * Meldet jeden Wechsel des Kontos an `core/auth/kontoWechsel` (@HT-060): Abmelden (Nutzer → keiner), anderes Konto (Nutzer a → Nutzer b).
 * Die erste Anmeldung eines Tabs (kein Nutzer davor) ist kein Wechsel; dasselbe Konto bleibt ohne Meldung (@HT-041).
 */
import { useEffect, useRef } from 'react';
import { meldeKontoWechsel } from '../../../core/auth/kontoWechsel';

export function useKontoWechselMeldung(userId: string | null): void {
  const davor = useRef<string | null>(userId);
  useEffect(() => {
    if (davor.current !== null && davor.current !== userId) {
      meldeKontoWechsel();
    }
    davor.current = userId;
  }, [userId]);
}
