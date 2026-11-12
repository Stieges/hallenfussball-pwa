/**
 * Geteilte Abfrage `hall_sound_status` je Turnier (H4-5): egal, wie viele Einbindungen (Kopfzeile, Streifen, Unterpunkt, Cockpit) den
 * Stand eines Turniers lesen – es läuft genau eine 5-s-Abfrage. Ein Zähler der Abonnenten startet sie beim ersten und beendet sie beim
 * letzten (dann ist auch der Stand weg: der nächste Abonnent beginnt mit „lädt“). Dazu hängt der erste Abonnent die Ereignisse
 * `online`/`offline` ein (sofort neu lesen). Rein bis auf den Fenster-Zugang; `bau` erzeugt die eigentliche Abfrage.
 */
import type { HallStatusAbfrage, HallStatusSchnappschuss } from './hallStatusAbfrage';

const LAEDT: HallStatusSchnappschuss = { stand: 'laedt', antwort: null, felder: {} };

interface Eintrag {
  abfrage: HallStatusAbfrage;
  abonnenten: number;
  loesen: () => void;
}

export interface GeteilteHallStatusAbfragen {
  /** Anmelden (Zähler +1, beim ersten Start der Abfrage); die Rückgabe meldet ab (beim letzten Ende der Abfrage). */
  abonniere(turnierId: string, beiAenderung: () => void): () => void;
  /** Stand; ohne Abonnent der Anfangsstand „lädt“ (immer dasselbe Objekt). */
  schnappschuss(turnierId: string): HallStatusSchnappschuss;
  /** Sofort neu lesen (z. B. nach einem Testton); ohne Abonnent nichts. */
  abfragen(turnierId: string): void;
}

export function erzeugeGeteilteAbfragen(
  bau: (turnierId: string) => HallStatusAbfrage,
  fenster: () => Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null,
): GeteilteHallStatusAbfragen {
  const eintraege = new Map<string, Eintrag>();

  return {
    abonniere(turnierId, beiAenderung) {
      let eintrag = eintraege.get(turnierId);
      if (eintrag === undefined) {
        const abfrage = bau(turnierId);
        const ziel = fenster();
        const neu = (): void => abfrage.abfragen();
        ziel?.addEventListener('online', neu);
        ziel?.addEventListener('offline', neu);
        eintrag = {
          abfrage, abonnenten: 0,
          loesen: () => {
            ziel?.removeEventListener('online', neu);
            ziel?.removeEventListener('offline', neu);
          },
        };
        eintraege.set(turnierId, eintrag);
      }
      const dieser = eintrag;
      dieser.abonnenten += 1;
      const abmeldenZuhoerer = dieser.abfrage.subscribe(beiAenderung);
      dieser.abfrage.start(); // ab dem zweiten Abonnenten ohne Wirkung
      let offen = true;
      return () => {
        if (!offen) {
          return;
        }
        offen = false;
        abmeldenZuhoerer();
        dieser.abonnenten -= 1;
        if (dieser.abonnenten === 0) {
          dieser.abfrage.stop();
          dieser.loesen();
          if (eintraege.get(turnierId) === dieser) {
            eintraege.delete(turnierId);
          }
        }
      };
    },
    schnappschuss: (turnierId) => eintraege.get(turnierId)?.abfrage.getSnapshot() ?? LAEDT,
    abfragen(turnierId) {
      eintraege.get(turnierId)?.abfrage.abfragen();
    },
  };
}
