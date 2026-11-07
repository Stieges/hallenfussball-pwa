/**
 * Unsichtbarer Baustein des Hallen-Lautsprechers (H3b-2b), in `App.tsx` neben `SyncManager`:
 * - Die Laufzeit entsteht nur, wenn dieses Gerät für ein Turnier als Lautsprecher eingeschaltet ist und ein echtes Konto
 *   angemeldet ist (kein Gast). Sonst entstehen weder Worker noch Abfrage.
 * - Bildschirm wach (`useWakeLock`), solange die Laufzeit hier tönt.
 * - Jeder Tab hört auf die Lautsprecher-Meldung des Geräts und hält dann das Reload-Tor zu (`lautsprecherReloadTor.ts`).
 * Keine Oberfläche: gibt `null` zurück.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useRepositories } from '../../core/contexts/RepositoryContext';
import { useWakeLock } from '../../hooks/useWakeLock';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { attachReloadGate } from '../../lib/swRegistration';
import { useMatchEngineContextOptional } from '../match-engine/useMatchEngineContext';
import { erzeugeBrowserKanal, erzeugeBrowserLaufzeit } from './browserLaufzeit';
import { abonniereGeraet, geraetStand, setzeLaufzeit } from './lautsprecherGeraet';
import type { LaufzeitSnapshot } from './runtime/HallLautsprecherLaufzeit';
import { verbindeLautsprecherReloadTor } from './runtime/lautsprecherReloadTor';
import { echterZeitgeber } from './runtime/zeitgeber';

const nieAbonniert = (): (() => void) => () => undefined;

export function HallLautsprecherLaufzeit(): null {
  const engine = useMatchEngineContextOptional();
  const { tournamentRepository } = useRepositories();
  const { einschaltung, laufzeit } = useSyncExternalStore(abonniereGeraet, geraetStand, geraetStand);
  const aktiv = einschaltung !== null && engine !== null && engine.accountId !== 'guest' && isSupabaseConfigured && supabase !== null;
  const turnierId = einschaltung?.turnierId ?? null;
  const felderSchluessel = einschaltung?.felder.join(',') ?? '';

  useEffect(() => {
    const kanal = erzeugeBrowserKanal();
    const loesen = verbindeLautsprecherReloadTor({ kanal, halteTor: attachReloadGate, zeitgeber: echterZeitgeber });
    return () => {
      loesen();
      kanal.schliessen();
    };
  }, []);

  useEffect(() => {
    const aktuell = geraetStand().einschaltung;
    if (!aktiv || engine === null || aktuell === null) {
      return undefined;
    }
    const { laufzeit: neu, beenden } = erzeugeBrowserLaufzeit({
      einschaltung: aktuell,
      engine,
      ladeTurnier: (id) => tournamentRepository.get(id),
    });
    setzeLaufzeit(neu);
    neu.start();
    return () => {
      beenden();
      setzeLaufzeit(null);
    };
  }, [aktiv, turnierId, felderSchluessel, engine, tournamentRepository]);

  const snapshot: LaufzeitSnapshot | null = useSyncExternalStore(
    laufzeit?.subscribe ?? nieAbonniert,
    () => laufzeit?.getSnapshot() ?? null,
    () => null,
  );
  useWakeLock(snapshot?.rolle === 'toent');
  return null;
}
