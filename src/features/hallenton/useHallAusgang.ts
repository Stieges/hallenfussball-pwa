/**
 * useHallAusgang() – Schnittstelle für die Ausgangswahl des Hallen-Lautsprechers (H4-6, @HT-053, @HT-054, @HT-055). Keine
 * Oberfläche: Anzeige, „🔈? Prüfen“ und die Taste „Ausgang bestätigen“ baut H4-11.
 *
 * - `verfuegbar`: der Browser kann den Ausgang wählen (`AudioContext.setSinkId`); sonst bleibt es bei „Standard“, `liste` ist leer.
 * - `gewaehlt`: Kennung, Name und Gruppen-ID der Wahl dieses Geräts oder `null` = „Standard (Ausgang des Systems)“. Lokal je Gerät,
 *   nie am Server; die Wahl erreicht jeden Tab des Geräts, auch den tönenden.
 * - `liste`: alle Ausgänge mit Namen, „Standard“ zuerst, virtuelle am Ende; leer, solange nicht gelesen wurde (`lesen()`, erst auf „Ändern“)
 *   oder das Mikrofon nicht freigegeben ist (dann nur „Standard“, `mikrofonErlauben()` fragt einmal und beendet den Strom sofort).
 * - `waehle(id | null)`: setzt die Wahl (`null` = Standard); eine unbekannte Kennung ändert nichts.
 * - `bestaetigen()` (@HT-055): ein Tipp ist die Nutzergeste für „Ton aktivieren“ UND die Mikrofon-Freigabe; danach gilt die
 *   gespeicherte Wahl wieder, ohne neue Wahl. `false`, wenn das Mikrofon abgelehnt wird (dann bleibt es bei „Ausgang bestätigen“).
 * - `zustand`: `standard` | `ok` | `lost` (Ausgang verschwunden, @HT-054) | `unconfirmed` (@HT-055).
 * Name und Kennung verlassen das Gerät nie (nicht ins Lebenszeichen, nicht in Sentry, nicht in Logs).
 * „Standard“ wählen und „Ausgang bestätigen“ ohne Wahl stoßen zusätzlich die anderen Tabs an (`pruefenAnstossen`): ein gescheiterter Wechsel auf „Standard“ lebt nur im Wächter des
 * tönenden Tabs, und ohne gespeicherte Wahl löst `removeItem` kein `storage`-Ereignis aus (H4-11b). Das liest nichts und fragt kein Mikrofon.
 * Beim Einbinden liest der Hook nichts. Nach `lesen()` (Oberfläche: „Ändern“) liest der Wächter bei jedem `devicechange` neu mit (folgenlos, nur die Liste
 * wird aktuell), bis `lesenBeenden()` („Schließen“) – außer das Gerät hat eine gespeicherte Wahl, dann bleibt er wach.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { STANDARD_AUSGANG_ID, type AusgangEintrag, type AusgangLage, type GewaehlterAusgang } from '../../core/hallenton';
import { browserAusgang, ausgangWaehlbar } from './runtime/ausgang/browserAusgang';
import { tonAktivierenAmGeraet } from './lautsprecherGeraet';

export interface HallAusgang {
  verfuegbar: boolean;
  gewaehlt: GewaehlterAusgang | null;
  liste: readonly AusgangEintrag[];
  zustand: AusgangLage;
  /**
   * Die Ausgänge jetzt lesen (`enumerateDevices`, `permissions.query`; nie ein Mikrofon-Dialog): die Oberfläche ruft es erst, wenn Olli „Ändern“
   * tippt (H4-11). Beim bloßen Einbinden des Hooks liest nichts – ein Gerät ohne gespeicherte Wahl verhält sich wie auf main.
   */
  lesen(): Promise<void>;
  /**
   * Die Liste wird nicht mehr gebraucht („Schließen“): ohne gespeicherte Wahl liest der Wächter bei `devicechange` nicht mehr mit. Mit Wahl
   * bleibt er wach (er muss das Abziehen bemerken, @HT-054).
   */
  lesenBeenden(): void;
  mikrofonErlauben(): Promise<boolean>;
  /** `false`: nichts geändert (Browser ohne Wahl, unbekannte Kennung oder der Speicher verweigert das Schreiben). */
  waehle(id: string | null): boolean;
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

  const lesen = useCallback((): Promise<void> => (verfuegbar ? browserAusgang().waechter.neuLesen() : Promise.resolve()), [verfuegbar]);
  const lesenBeenden = useCallback((): void => { browserAusgang().waechter.lesenBeenden(); }, []);

  const mikrofonErlauben = useCallback(async (): Promise<boolean> => {
    const { liste, wahl, waechter } = browserAusgang();
    const erlaubt = await liste.mikrofonErlauben(); // synchron in der Geste gestartet
    await waechter.neuLesen();
    if (erlaubt) {
      wahl.pruefenAnstossen(); // die anderen Tabs (der tönende) lesen neu
    }
    return erlaubt;
  }, []);

  const waehle = useCallback((id: string | null): boolean => {
    const { wahl, waechter } = browserAusgang();
    if (!verfuegbar) {
      return false; // Browser ohne Ausgangswahl: „Standard“, nichts zu wählen
    }
    if (id === null || id === STANDARD_AUSGANG_ID) {
      const ok = wahl.setzen(null);
      waechter.standardErneut(); // ist ein früherer Wechsel auf „Standard“ gescheitert, versucht dieser Tipp ihn erneut
      wahl.pruefenAnstossen(); // …auch im tönenden ANDEREN Tab: `removeItem` auf einen fehlenden Schlüssel löst kein `storage`-Ereignis aus (H4-11b)
      return ok;
    }
    const eintrag = waechter.liste().eintraege.find((e) => e.id === id);
    return eintrag ? wahl.setzen({ id: eintrag.id, name: eintrag.name, gruppe: eintrag.gruppe }) : false;
  }, [verfuegbar]);

  const bestaetigen = useCallback(async (): Promise<boolean> => {
    const ton = tonAktivierenAmGeraet(); // `resume()` synchron in der Geste, vor dem ersten `await`
    const { waechter, wahl } = browserAusgang();
    if (waechter.wahl() === null) {
      // „Standard“ gewählt, der Wechsel dahin ist gescheitert (H4-11): kein Mikrofon nötig, ein Tipp versucht den Wechsel erneut
      waechter.standardErneut();
      wahl.pruefenAnstossen(); // der Fehler lebt im Wächter des tönenden Tabs: dieser Tab muss ihn anstoßen (H4-11b)
      await ton;
      return true;
    }
    const erlaubt = await mikrofonErlauben();
    await ton;
    return erlaubt;
  }, [mikrofonErlauben]);

  return useMemo(() => ({
    verfuegbar,
    gewaehlt: aktuell.gewaehlt,
    liste: verfuegbar ? aktuell.liste : [],
    zustand: aktuell.zustand,
    lesen,
    lesenBeenden,
    mikrofonErlauben,
    waehle,
    bestaetigen,
  }), [verfuegbar, aktuell, lesen, lesenBeenden, mikrofonErlauben, waehle, bestaetigen]);
}
