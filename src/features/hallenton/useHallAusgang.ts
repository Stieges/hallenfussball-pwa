/**
 * useHallAusgang() – Schnittstelle für die Ausgangswahl des Hallen-Lautsprechers (H4-6, @HT-053, @HT-054, @HT-055). Keine
 * Oberfläche: Anzeige, „🔈? Prüfen“ und die Taste „Ausgang bestätigen“ baut H4-11.
 *
 * - `verfuegbar`: der Browser kann den Ausgang wählen (`AudioContext.setSinkId`); sonst bleibt es bei „Standard“, `liste` ist leer.
 * - `gewaehlt`: Kennung, Name und Gruppen-ID der Wahl dieses Geräts oder `null` = „Standard (Ausgang des Systems)“. Lokal je Gerät,
 *   nie am Server; die Wahl erreicht jeden Tab des Geräts, auch den tönenden.
 * - `liste`: alle Ausgänge mit Namen, „Standard“ zuerst, virtuelle am Ende; leer, solange das Mikrofon nicht freigegeben ist
 *   (dann nur „Standard“, `mikrofonErlauben()` fragt einmal und beendet den Strom sofort).
 * - `waehle(id | null)`: setzt die Wahl (`null` = Standard); eine unbekannte Kennung ändert nichts.
 * - `bestaetigen()` (@HT-055): ein Tipp ist die Nutzergeste für „Ton aktivieren“ UND die Mikrofon-Freigabe; danach gilt die
 *   gespeicherte Wahl wieder, ohne neue Wahl. `false`, wenn das Mikrofon abgelehnt wird (dann bleibt es bei „Ausgang bestätigen“).
 * - `zustand`: `standard` | `ok` | `lost` (Ausgang verschwunden, @HT-054) | `unconfirmed` (@HT-055).
 * Name und Kennung verlassen das Gerät nie (nicht ins Lebenszeichen, nicht in Sentry, nicht in Logs).
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { STANDARD_AUSGANG_ID, type AusgangEintrag, type AusgangLage, type GewaehlterAusgang } from '../../core/hallenton';
import { browserAusgang, ausgangWaehlbar } from './runtime/ausgang/browserAusgang';
import { tonAktivierenAmGeraet } from './lautsprecherGeraet';

export interface HallAusgang {
  verfuegbar: boolean;
  gewaehlt: GewaehlterAusgang | null;
  liste: readonly AusgangEintrag[];
  zustand: AusgangLage;
  mikrofonErlauben(): Promise<boolean>;
  waehle(id: string | null): void;
  bestaetigen(): Promise<boolean>;
}

interface Stand {
  gewaehlt: GewaehlterAusgang | null;
  liste: readonly AusgangEintrag[];
  zustand: AusgangLage;
}

let letzter: Stand | null = null;

/** Stabiler Schnappschuss: ein neues Objekt nur, wenn sich Wahl, Liste oder Lage ändern. */
function stand(): Stand {
  const { waechter } = browserAusgang();
  const gewaehlt = waechter.wahl();
  const liste = waechter.liste().eintraege;
  const zustand = waechter.lage();
  if (letzter?.gewaehlt === gewaehlt && letzter.liste === liste && letzter.zustand === zustand) {
    return letzter;
  }
  letzter = { gewaehlt, liste, zustand };
  return letzter;
}

const abonniere = (fn: () => void): (() => void) => browserAusgang().waechter.beobachten(fn);
const KEIN_STAND: Stand = { gewaehlt: null, liste: [], zustand: 'standard' };

export function useHallAusgang(): HallAusgang {
  const aktuell = useSyncExternalStore(abonniere, stand, () => KEIN_STAND);
  const verfuegbar = ausgangWaehlbar();

  useEffect(() => {
    if (verfuegbar) {
      void browserAusgang().waechter.neuLesen(); // lesen ohne Nachfrage: ohne Freigabe nur „Standard“
    }
  }, [verfuegbar]);

  const mikrofonErlauben = useCallback(async (): Promise<boolean> => {
    const { liste, wahl, waechter } = browserAusgang();
    const erlaubt = await liste.mikrofonErlauben(); // synchron in der Geste gestartet
    await waechter.neuLesen();
    if (erlaubt) {
      wahl.pruefenAnstossen(); // die anderen Tabs (der tönende) lesen neu
    }
    return erlaubt;
  }, []);

  const waehle = useCallback((id: string | null) => {
    const { wahl, waechter } = browserAusgang();
    if (!verfuegbar) {
      return; // Browser ohne Ausgangswahl: „Standard“, nichts zu wählen
    }
    if (id === null || id === STANDARD_AUSGANG_ID) {
      wahl.setzen(null);
      return;
    }
    const eintrag = waechter.liste().eintraege.find((e) => e.id === id);
    if (eintrag) {
      wahl.setzen({ id: eintrag.id, name: eintrag.name, gruppe: eintrag.gruppe });
    }
  }, [verfuegbar]);

  const bestaetigen = useCallback(async (): Promise<boolean> => {
    const ton = tonAktivierenAmGeraet(); // `resume()` synchron in der Geste, vor dem ersten `await`
    const erlaubt = await mikrofonErlauben();
    await ton;
    return erlaubt;
  }, [mikrofonErlauben]);

  return useMemo(() => ({
    verfuegbar,
    gewaehlt: aktuell.gewaehlt,
    liste: verfuegbar ? aktuell.liste : [],
    zustand: aktuell.zustand,
    mikrofonErlauben,
    waehle,
    bestaetigen,
  }), [verfuegbar, aktuell, mikrofonErlauben, waehle, bestaetigen]);
}
