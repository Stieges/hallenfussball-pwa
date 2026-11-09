/**
 * Prüfung auf Turnierende im Lebenszeichen (aus `lautsprecherLebenszeichen.ts`, H4-1; Fixrunde 1, W1): Jeder Tab prüft höchstens
 * alle 30 s die lokale Turnierkopie (`turnierBeendet`) und schaltet still ab, auch der wartende; das erste Lebenszeichen wartet
 * auf die erste Prüfung, höchstens 2 s (N1 aus H3b-3: kehrt das Lesen nicht zurück, gilt „nicht beendet“).
 */
import type { Zeitgeber } from './zeitgeber';

/** Turnierende aus der lokalen Kopie höchstens so oft prüfen (ms). */
export const TURNIERENDE_PRUEF_MS = 30_000;
/** Frist der Prüfung auf Turnierende (N1): danach gilt „nicht beendet“, das Lebenszeichen geht raus. */
export const TURNIERENDE_FRIST_MS = 2000;

export interface TurnierendePruefungDeps {
  zeitgeber: Zeitgeber;
  /** Turnier abgeschlossen oder abgebrochen? (lokale Turnierkopie, W1); ohne: nie beendet. */
  turnierBeendet?: () => Promise<boolean>;
  /** Eine Prüfung ist fertig (auch „nicht beendet“). */
  fertig: (beendet: boolean) => void;
}

export interface TurnierendePruefung {
  /** Stößt die Prüfung an, wenn fällig; `true` = noch keine Prüfung abgeschlossen (dann wird nicht gemeldet). */
  offen(): boolean;
}

export function erzeugeTurnierendePruefung(d: TurnierendePruefungDeps): TurnierendePruefung {
  let geprueftUm: number | null = null;
  let laeuft = false;

  /** N1: Ein Fehler oder eine Prüfung ohne Rückkehr binnen 2 s gilt als „nicht beendet“. */
  function mitFrist(pruefung: Promise<boolean>): Promise<boolean> {
    return new Promise((fertig) => {
      const abbrechen = d.zeitgeber.spaeter(() => fertig(false), TURNIERENDE_FRIST_MS);
      void pruefung.catch(() => false).then((beendet) => {
        abbrechen();
        fertig(beendet);
      });
    });
  }

  return {
    offen() {
      const pruef = d.turnierBeendet;
      if (!pruef) {
        return false;
      }
      const jetzt = d.zeitgeber.jetzt();
      if (!laeuft && (geprueftUm === null || jetzt - geprueftUm >= TURNIERENDE_PRUEF_MS)) {
        laeuft = true;
        void mitFrist(pruef()).then((beendet) => {
          laeuft = false;
          geprueftUm = d.zeitgeber.jetzt();
          d.fertig(beendet);
        });
      }
      return geprueftUm === null;
    },
  };
}
