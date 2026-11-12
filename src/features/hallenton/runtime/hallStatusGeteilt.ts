/**
 * Geteilte Abfrage `hall_sound_status` je Turnier (H4-5): egal, wie viele Einbindungen (Kopfzeile, Streifen, Unterpunkt, Cockpit) den
 * Stand eines Turniers lesen – es läuft genau eine 5-s-Abfrage. Ein Zähler der Abonnenten startet sie beim ersten Abonnenten.
 * Fixrunde 1 (M1): Beim letzten Abmelden läuft die Abfrage noch `NACHLAUF_MS` weiter und behält ihren Stand. Ein Seitenwechsel
 * (Kopfzeile ab, andere an) löst so keinen zweiten Aufruf und keinen leeren Zwischenstand aus; erst nach dem Nachlauf endet sie und
 * der Stand ist weg. „Ein Lautsprecher war bekannt“ gilt je Turnier für die ganze Sitzung (@HT-041: ohne Netz bleibt „Status
 * unbekannt“ auch nach dem Seitenwechsel; @HT-038: ohne je einen Lautsprecher gibt es keine Warnung). Dazu hängt der erste Abonnent
 * die Ereignisse `online`/`offline` ein (sofort neu lesen). Rein bis auf den Fenster-Zugang; `bau` erzeugt die eigentliche Abfrage.
 */
import type { HallStatusAbfrage, HallStatusSchnappschuss } from './hallStatusAbfrage';
import type { Zeitgeber } from './zeitgeber';

const LAEDT: HallStatusSchnappschuss = { stand: 'laedt', antwort: null, felder: {} };
/** So lange läuft die Abfrage nach dem letzten Abmelden weiter (zwei Takte), damit ein Seitenwechsel nichts verliert. */
export const NACHLAUF_MS = 10_000;

interface Eintrag {
  abfrage: HallStatusAbfrage;
  abonnenten: number;
  loesen: () => void;
  /** Bricht den geplanten Abbau ab (gesetzt, solange kein Abonnent da ist). */
  nachlaufAbbrechen: (() => void) | null;
}

export interface GeteilteHallStatusAbfragen {
  /** Anmelden (Zähler +1, beim ersten Start der Abfrage); die Rückgabe meldet ab (nach dem Nachlauf Ende der Abfrage). */
  abonniere(turnierId: string, beiAenderung: () => void): () => void;
  /** Stand; ohne laufende Abfrage der Anfangsstand „lädt“ (immer dasselbe Objekt). */
  schnappschuss(turnierId: string): HallStatusSchnappschuss;
  /** Sofort neu lesen (z. B. nach einem Testton); ohne laufende Abfrage nichts. */
  abfragen(turnierId: string): void;
  /** In dieser Sitzung wurde für das Turnier schon ein Lautsprecher gemeldet. */
  lautsprecherBekannt(turnierId: string): boolean;
  /** Nur für Tests: alles beenden und vergessen. */
  zuruecksetzen(): void;
}

export function erzeugeGeteilteAbfragen(
  bau: (turnierId: string) => HallStatusAbfrage,
  fenster: () => Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null,
  zeitgeber: Pick<Zeitgeber, 'spaeter'>,
): GeteilteHallStatusAbfragen {
  const eintraege = new Map<string, Eintrag>();
  const bekannt = new Set<string>();

  const merke = (turnierId: string, abfrage: HallStatusAbfrage): void => {
    if (Object.keys(abfrage.getSnapshot().felder).length > 0) {
      bekannt.add(turnierId);
    }
  };

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
          abfrage, abonnenten: 0, nachlaufAbbrechen: null,
          loesen: () => {
            ziel?.removeEventListener('online', neu);
            ziel?.removeEventListener('offline', neu);
          },
        };
        eintraege.set(turnierId, eintrag);
      }
      const dieser = eintrag;
      dieser.nachlaufAbbrechen?.(); // ein Abonnent im Nachlauf übernimmt die laufende Abfrage
      dieser.nachlaufAbbrechen = null;
      dieser.abonnenten += 1;
      const abmeldenZuhoerer = dieser.abfrage.subscribe(() => {
        merke(turnierId, dieser.abfrage);
        beiAenderung();
      });
      dieser.abfrage.start(); // läuft sie schon, ohne Wirkung
      merke(turnierId, dieser.abfrage);
      let offen = true;
      return () => {
        if (!offen) {
          return;
        }
        offen = false;
        abmeldenZuhoerer();
        dieser.abonnenten -= 1;
        if (dieser.abonnenten === 0) {
          dieser.nachlaufAbbrechen = zeitgeber.spaeter(() => {
            dieser.nachlaufAbbrechen = null;
            dieser.abfrage.stop();
            dieser.loesen();
            if (eintraege.get(turnierId) === dieser) {
              eintraege.delete(turnierId);
            }
          }, NACHLAUF_MS);
        }
      };
    },
    schnappschuss: (turnierId) => eintraege.get(turnierId)?.abfrage.getSnapshot() ?? LAEDT,
    abfragen(turnierId) {
      eintraege.get(turnierId)?.abfrage.abfragen();
    },
    lautsprecherBekannt: (turnierId) => bekannt.has(turnierId),
    zuruecksetzen() {
      for (const e of eintraege.values()) {
        e.nachlaufAbbrechen?.();
        e.abfrage.stop();
        e.loesen();
      }
      eintraege.clear();
      bekannt.clear();
    },
  };
}
