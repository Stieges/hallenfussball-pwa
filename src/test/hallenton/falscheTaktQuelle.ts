/**
 * Test-Fälschung der Taktquelle (H3b-1): echter Hauptthread-Adapter und echter Worker-Kern, verbunden ohne echten Worker,
 * mit von Hand vorgerückter Zeit. Für die Laufzeit-Tests in H3b-2/3.
 *
 *   const takt = erzeugeFalscheTaktQuelle();
 *   takt.quelle.start();
 *   takt.uhr.vorruecken(1000);        // 4 Takte
 *   takt.workerAussetzen();           // Worker schweigt (Hintergrund, @HT-014)
 *   takt.uhr.vorruecken(4000);        // Hauptthread meldet den Aussetzer
 *   takt.workerWeiter();              // Takt kommt wieder, Aussetzer endet
 */
import { erzeugeTaktQuelle, type TaktQuelle, type WorkerVerbindung } from '../../features/hallenton/runtime/taktQuelle';
import { verbindeTaktWorker } from '../../features/hallenton/runtime/taktWorkerKern';
import { ManuelleUhr } from './manuelleUhr';

export interface FalscheTaktQuelle {
  quelle: TaktQuelle;
  uhr: ManuelleUhr;
  /** Wie oft ein Worker erzeugt wurde. */
  erzeugt: () => number;
  workerAussetzen: () => void;
  workerWeiter: () => void;
  /** Der Worker meldet einen Fehler (z. B. Datei nach einem Update aus dem Cache entfernt). */
  workerFehler: () => void;
}

export interface FalscheTaktOptionen {
  startMs?: number;
  erzeugenScheitert?: boolean;
  /** Gemeinsame Uhr mehrerer Tabs (H3b-2b); sonst eine eigene ab `startMs`. */
  uhr?: ManuelleUhr;
  /** Unterscheidet die Zeitgruppen mehrerer Tabs (`worker<name>`, `haupt<name>`). */
  name?: string;
}

export function erzeugeFalscheTaktQuelle(optionen: FalscheTaktOptionen = {}): FalscheTaktQuelle {
  const uhr = optionen.uhr ?? new ManuelleUhr(optionen.startMs ?? 0);
  const name = optionen.name ?? '';
  let anzahl = 0;
  let fehlerMelden: (() => void) | null = null;

  const erzeugeWorker = (): WorkerVerbindung => {
    if (optionen.erzeugenScheitert) {
      throw new Error('Worker nicht erzeugbar');
    }
    anzahl += 1;
    let anHaupt: ((daten: unknown) => void) | null = null;
    let anWorker: ((daten: unknown) => void) | null = null;
    let beendet = false;
    verbindeTaktWorker({
      senden: (nachricht) => {
        if (!beendet) {
          anHaupt?.(nachricht);
        }
      },
      beiNachricht: (fn) => {
        anWorker = fn;
      },
    }, uhr.gruppe(`worker${name}`));
    return {
      senden: (nachricht) => {
        if (!beendet) {
          anWorker?.(nachricht);
        }
      },
      beenden: () => {
        anWorker?.({ art: 'stop' });
        beendet = true;
      },
      beiNachricht: (fn) => {
        anHaupt = fn;
      },
      beiFehler: (fn) => {
        fehlerMelden = fn;
      },
    };
  };

  const quelle = erzeugeTaktQuelle({ erzeugeWorker, zeitgeber: uhr.gruppe(`haupt${name}`) });
  return {
    quelle,
    uhr,
    erzeugt: () => anzahl,
    workerAussetzen: () => uhr.stummschalten(`worker${name}`),
    workerWeiter: () => uhr.lautschalten(`worker${name}`),
    workerFehler: () => fehlerMelden?.(),
  };
}
