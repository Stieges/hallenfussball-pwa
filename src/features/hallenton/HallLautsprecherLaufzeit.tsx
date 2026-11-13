/**
 * Unsichtbarer Baustein des Hallen-Lautsprechers (H3b-2b), in `App.tsx` neben `SyncManager`:
 * - Die Laufzeit entsteht nur, wenn dieses Gerät für ein Turnier als Lautsprecher eingeschaltet ist und ein echtes Konto
 *   angemeldet ist (kein Gast). Sonst entstehen weder Worker noch Abfrage.
 * - Bildschirm wach (`useWakeLock`), solange die Laufzeit hier tönt.
 * - Jeder Tab hört auf die Lautsprecher-Meldung des Geräts und hält dann das Reload-Tor zu (`lautsprecherReloadTor.ts`).
 * - H4-1 (N2): Ein neues Zugangs-Token (SIGNED_IN/TOKEN_REFRESHED, wie `MatchEngineProvider` es über `session.token` sieht) beendet
 *   ein „still“ nach dreimal `kein_recht` (`erneutVersuchen(false)`); kein eigener Supabase-Listener.
 * - H3b-3, auf jedem angemeldeten Gerät (kein Gast): Lebenszeichen der Leitung (`leitungGeraet.ts`), eine offene Abmeldung
 *   nachholen (`ausstehendeAbmeldung.ts`).
 * Keine Oberfläche: gibt `null` zurück.
 */
import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { useWakeLock } from '../../hooks/useWakeLock';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { attachReloadGate } from '../../lib/swRegistration';
import { AuthContext } from '../auth/context/authContextInstance';
import { useMatchEngineContextOptional } from '../match-engine/useMatchEngineContext';
import { abmeldungNachholen, ABMELDEN_NEU_MS } from './ausstehendeAbmeldung';
import { erzeugeBrowserKanal, erzeugeBrowserLaufzeit } from './browserLaufzeit';
import { erzeugeBrowserLeitung, setzeLeitung } from './leitungGeraet';
import { ladeTurnierLokal } from './lokalesTurnier';
import { abonniereGeraet, erneutVersuchen, geraetStand, setzeLaufzeit } from './lautsprecherGeraet';
import type { LaufzeitSnapshot } from './runtime/HallLautsprecherLaufzeit';
import { verbindeLautsprecherReloadTor } from './runtime/lautsprecherReloadTor';
import { echterZeitgeber } from './runtime/zeitgeber';

const nieAbonniert = (): (() => void) => () => undefined;

export function HallLautsprecherLaufzeit(): null {
  const engine = useMatchEngineContextOptional();
  const { einschaltung, laufzeit } = useSyncExternalStore(abonniereGeraet, geraetStand, geraetStand);
  const konto = engine !== null && engine.accountId !== 'guest' && isSupabaseConfigured && supabase !== null;
  const aktiv = einschaltung !== null && konto;
  const turnierId = einschaltung?.turnierId ?? null;
  const felderSchluessel = einschaltung?.felder.join(',') ?? '';
  const token = useContext(AuthContext)?.session?.token; // ohne Provider (Tests): kein Token
  const letzterToken = useRef(token);

  useEffect(() => {
    if (token !== undefined && token !== letzterToken.current) {
      erneutVersuchen(false); // Neu-Anmeldung dieses Tabs: ein „still“ nach kein_recht endet (die anderen Tabs sehen ihr eigenes Token)
    }
    letzterToken.current = token;
  }, [token]);

  useEffect(() => {
    const kanal = erzeugeBrowserKanal();
    const loesen = verbindeLautsprecherReloadTor({ kanal, halteTor: attachReloadGate, zeitgeber: echterZeitgeber });
    return () => {
      loesen();
      kanal.schliessen();
    };
  }, []);

  useEffect(() => {
    if (!konto || engine === null) {
      return undefined;
    }
    const leitung = erzeugeBrowserLeitung({ engine, ladeTurnier: ladeTurnierLokal }); // W2: nur lokal
    setzeLeitung(leitung);
    leitung.start();
    const nachholen = (): void => {
      void abmeldungNachholen(supabase);
    };
    nachholen();
    window.addEventListener('online', nachholen);
    const takt = window.setInterval(nachholen, ABMELDEN_NEU_MS);
    return () => {
      leitung.stop();
      setzeLeitung(null);
      window.removeEventListener('online', nachholen);
      window.clearInterval(takt);
    };
  }, [konto, engine]);

  useEffect(() => {
    const aktuell = geraetStand().einschaltung;
    if (!aktiv || engine === null || aktuell === null) {
      return undefined;
    }
    const { laufzeit: neu, starten, beenden } = erzeugeBrowserLaufzeit({
      einschaltung: aktuell,
      engine,
      ladeTurnier: ladeTurnierLokal, // W2: nur lokal, kein Abgleich mit der Cloud je Lebenszeichen
    });
    setzeLaufzeit(neu);
    starten();
    return () => {
      beenden();
      setzeLaufzeit(null);
    };
  }, [aktiv, turnierId, felderSchluessel, engine]);

  const snapshot: LaufzeitSnapshot | null = useSyncExternalStore(
    laufzeit?.subscribe ?? nieAbonniert,
    () => laufzeit?.getSnapshot() ?? null,
    () => null,
  );
  useWakeLock(snapshot?.rolle === 'toent');
  return null;
}
