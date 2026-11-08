/**
 * Steuerung der Torhymne in der Lautsprecher-Laufzeit (H3c, @HT-024): bringt die Entscheidung des Kerns (`planeTorhymne`) im
 * Takt des tönenden Tabs zum Spieler (`hymnen`). Die Laufzeit verdrahtet nur (`HallLautsprecherLaufzeit.ts`).
 *
 * - Wahl des Turniers (`TorWahl`): Felder mit „Ton bei Tor“ und die Torhymnen (öffentliche Adressen) aus `hall_sound_status`.
 *   Geladen wird erst in einem aktivierten Tab (wartende Tabs ohne Last, k-neu-3), vorab und bei jeder geänderten Liste.
 * - Die Hymne startet, sobald das Tor im frischen Stand bekannt ist (keine Vorausplanung), nur mit Antwort ≤ 5 s (der
 *   Kern prüft das). Der Reihe nach über das Gerät, nie zweimal hintereinander dieselbe; den Zähler (zuletzt gespielte
 *   Adresse) hält die Laufzeit im Speicher – nach dem Neuladen beginnt die Reihe vorn (gilt nach Vorschlag, Brief H3c).
 * - Abbruch im Takt (Rücknahme, Ende des Spiels); zum Beginn eines End-Tons bricht der Spieler sie selbst ab.
 * - Fixrunde 1: Ist eine Hymne der aktuellen Liste nicht spielbar (Laden gescheitert), holt der tönende Tab sie im Takt
 *   erneut, frühestens 30 s nach dem Bemerken bzw. dem letzten Versuch und nie zwei Versuche zugleich (kein Dauerfeuer).
 * - `abschalten()` (Tab gibt die Sperre ab, Turnierende): Hymne aus, Gedächtnis der Tore vergessen – ein neuer Beginn nimmt
 *   den dann bekannten Stand als ersten (kein Nachholen).
 */
import {
  LEERES_TOR_GEDAECHTNIS, naechsteHymne, planeTorhymne, type FeldStand, type LaufendeHymne, type TorGedaechtnis,
} from '../../../core/hallenton';
import { feldKennung } from './aktuellesSpielJeFeld';
import type { HallTonSpieler } from './hallTonSpieler';

export interface TorWahl {
  /** Felder (1, 2, …) mit „Ton bei Tor“. */
  felder: readonly number[];
  /** Öffentliche Adressen der Torhymnen in ihrer Reihenfolge. */
  hymnen: readonly string[];
}

export const KEINE_TORWAHL: TorWahl = { felder: [], hymnen: [] };
/** Mindestabstand der Versuche, eine nicht geladene Hymne erneut zu holen (Serverzeit, ms). */
export const NACHLADEN_ABSTAND_MS = 30_000;

export interface TorhymnenSteuerung {
  /** Neue Wahl des Turniers; lädt die Hymnen, wenn der Tab aktiviert ist und sich die Liste geändert hat. */
  setzen(wahl: TorWahl): void;
  /** Der Tab ist aktiviert: ab jetzt laden. */
  aktiviert(): void;
  /** „Anhören“: die Hymnen laden, falls noch nicht (mit `wahl`, wenn eine neuere bekannt ist). */
  zumAnhoeren(wahl?: TorWahl): Promise<void>;
  /** Im Takt des tönenden Tabs, nach dem Stand am Server (`staende` zum Zeitpunkt `now`). */
  imTakt(staende: readonly FeldStand[], now: number): void;
  abschalten(): void;
}

export function erzeugeTorhymnenSteuerung({ spieler, start = KEINE_TORWAHL }: { spieler: Pick<HallTonSpieler, 'hymnen'>; start?: TorWahl }): TorhymnenSteuerung {
  const { hymnen } = spieler;
  let wahl = start;
  let aktiv = false;
  let geladenFuer: string | null = null;
  let gedaechtnis: TorGedaechtnis = LEERES_TOR_GEDAECHTNIS;
  let laufend: LaufendeHymne | null = null;
  let zuletzt: string | null = null;
  let versuchUm: number | null = null;
  let nachlaedt = false;

  /** Nicht spielbare Hymne der aktuellen Liste: höchstens ein Versuch je 30 s. */
  const nachladenWennNoetig = (now: number): void => {
    const gleicheListe = JSON.stringify(hymnen.liste()) === JSON.stringify(wahl.hymnen);
    if (!aktiv || nachlaedt || !gleicheListe || !hymnen.spielbar().includes(false)) {
      return;
    }
    if (versuchUm === null) {
      versuchUm = now; // bemerkt: ab jetzt zählt der Abstand
      return;
    }
    if (now - versuchUm >= NACHLADEN_ABSTAND_MS) {
      versuchUm = now;
      nachlaedt = true;
      void hymnen.nachladen().catch(() => undefined).finally(() => {
        nachlaedt = false;
      });
    }
  };

  const laden = (): Promise<unknown> => {
    const schluessel = JSON.stringify(wahl.hymnen);
    if (schluessel === geladenFuer) {
      return Promise.resolve();
    }
    geladenFuer = schluessel;
    versuchUm = null;
    return hymnen.laden(wahl.hymnen).catch(() => {
      geladenFuer = null; // beim nächsten Anlass erneut versuchen
    });
  };

  return {
    setzen(neu) {
      wahl = neu;
      if (aktiv) {
        void laden();
      }
    },
    aktiviert() {
      aktiv = true;
      void laden();
    },
    async zumAnhoeren(neu) {
      if (neu) {
        wahl = neu;
      }
      await laden();
    },
    imTakt(staende, now) {
      nachladenWennNoetig(now);
      if (laufend && !hymnen.laeuft()) {
        laufend = null; // zu Ende gespielt oder vom Spieler beendet (End-Ton)
      }
      const plan = planeTorhymne({ felder: staende, torFelder: wahl.felder.map(feldKennung), serverNow: now, laufend }, gedaechtnis);
      gedaechtnis = plan.gedaechtnis;
      if (plan.abbrechen) {
        hymnen.stoppen();
        laufend = null;
      }
      if (plan.starten) {
        const i = naechsteHymne(hymnen.liste(), hymnen.spielbar(), zuletzt);
        if (i !== null && hymnen.spielen(i)) {
          laufend = plan.starten;
          zuletzt = hymnen.liste()[i];
        }
      }
    },
    abschalten() {
      hymnen.stoppen();
      laufend = null;
      gedaechtnis = LEERES_TOR_GEDAECHTNIS;
    },
  };
}
