/**
 * Taktquelle des Hallen-Lautsprechers (H3b-1): Hauptthread-Adapter des Takt-Workers.
 *
 * - Takt alle 250 ms und Weckrufe zu angefragten Zeitpunkten kommen aus einem eigenen Dedicated Worker; der Takt im
 *   Hauptthread scheitert im Hintergrund (Spike 06.11.: bis 58 s zu spät), der Worker nicht (Aussetzer bis 1,6 s).
 * - Der Worker wird einmal bei `start()` erzeugt, nicht kurz vor dem Ton (Spike: Start bis 1,7 s).
 * - Bleibt der Takt länger als 3 s aus, meldet `onAussetzer` Beginn und Ende. Das ist die Grundlage für den Zustand
 *   `background` (@HT-014: nie das bloße Verdecken). Eine Wache im Hauptthread (1 s) meldet den Beginn; ist auch sie
 *   gedrosselt, meldet der nächste Takt Beginn und Ende nach.
 * - Scheitert das Erzeugen oder meldet der Worker einen Fehler (z. B. Datei nach einem Update nicht mehr im Cache),
 *   wechselt die Quelle in `fehler` und meldet das über `onFehler`, statt still zu bleiben.
 */
import type { AnTaktWorker } from './taktWorkerKern';
import { echterZeitgeber, type Zeitgeber } from './zeitgeber';

export const TAKT_MS = 250;
export const AUSSETZER_AB_MS = 3000;
const WACHE_MS = 1000;

export type TaktZustand = 'aus' | 'laeuft' | 'aussetzer' | 'fehler';
export type AussetzerEreignis = { art: 'beginn'; seitMs: number } | { art: 'ende'; dauerMs: number };

export interface TaktQuelle {
  start(): void;
  stop(): void;
  /** Takt alle 250 ms; `mono` ist die monotone Zeit des Workers in ms (`timeOrigin + now`). */
  onTakt(fn: (mono: number) => void): () => void;
  /** Weckruf mit `mono` des Workers beim Auslösen (verspätet, wenn der Worker aussetzte). */
  onWeckruf(fn: (id: string, mono: number) => void): () => void;
  onAussetzer(fn: (ereignis: AussetzerEreignis) => void): () => void;
  onFehler(fn: () => void): () => void;
  /** Weckruf in `inMs` ms; dieselbe Kennung ersetzt den alten. `false`, wenn die Quelle nicht läuft. */
  wecken(id: string, inMs: number): boolean;
  abbrechen(id: string): void;
  zustand(): TaktZustand;
}

/** Verbindung zum Worker; im Browser `new Worker(…)`, im Test der Kern ohne Worker. */
export interface WorkerVerbindung {
  senden(nachricht: AnTaktWorker): void;
  beenden(): void;
  beiNachricht(fn: (daten: unknown) => void): void;
  beiFehler(fn: () => void): void;
}

export interface TaktQuelleAbhaengigkeiten {
  erzeugeWorker: () => WorkerVerbindung;
  zeitgeber: Zeitgeber;
}

class Zuhoerer<T> {
  private readonly fns = new Set<(wert: T) => void>();
  an(fn: (wert: T) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }
  melden(wert: T): void {
    for (const fn of [...this.fns]) {
      fn(wert);
    }
  }
}

type VomWorker = { art: 'takt'; mono: number } | { art: 'weckruf'; id: string; mono: number };

function alsVomWorker(daten: unknown): VomWorker | null {
  if (!daten || typeof daten !== 'object') {
    return null;
  }
  const n = daten as { art?: unknown; mono?: unknown; id?: unknown };
  if (n.art === 'takt' && typeof n.mono === 'number') {
    return { art: 'takt', mono: n.mono };
  }
  if (n.art === 'weckruf' && typeof n.id === 'string' && typeof n.mono === 'number') {
    return { art: 'weckruf', id: n.id, mono: n.mono };
  }
  return null;
}

export function erzeugeTaktQuelle({ erzeugeWorker, zeitgeber }: TaktQuelleAbhaengigkeiten): TaktQuelle {
  const takte = new Zuhoerer<number>();
  const weckrufe = new Zuhoerer<{ id: string; mono: number }>();
  const aussetzer = new Zuhoerer<AussetzerEreignis>();
  const fehler = new Zuhoerer<undefined>();
  let zustand: TaktZustand = 'aus';
  let worker: WorkerVerbindung | null = null;
  let wacheAbbrechen: (() => void) | null = null;
  let letzterTakt = 0;

  const aufraeumen = (): void => {
    wacheAbbrechen?.();
    wacheAbbrechen = null;
    worker?.beenden();
    worker = null;
  };

  const fehlerSetzen = (): void => {
    if (zustand === 'fehler') {
      return;
    }
    aufraeumen();
    zustand = 'fehler';
    fehler.melden(undefined);
  };

  const wache = (): void => {
    const luecke = zeitgeber.jetzt() - letzterTakt;
    if (zustand === 'laeuft' && luecke > AUSSETZER_AB_MS) {
      zustand = 'aussetzer';
      aussetzer.melden({ art: 'beginn', seitMs: luecke });
    }
  };

  const empfangen = (daten: unknown): void => {
    if (zustand !== 'laeuft' && zustand !== 'aussetzer') {
      return;
    }
    const nachricht = alsVomWorker(daten);
    if (!nachricht) {
      return;
    }
    if (nachricht.art === 'weckruf') {
      weckrufe.melden({ id: nachricht.id, mono: nachricht.mono });
      return;
    }
    const jetzt = zeitgeber.jetzt();
    const luecke = jetzt - letzterTakt;
    if (zustand === 'laeuft' && luecke > AUSSETZER_AB_MS) {
      aussetzer.melden({ art: 'beginn', seitMs: luecke });
      zustand = 'aussetzer';
    }
    letzterTakt = jetzt;
    if (zustand === 'aussetzer') {
      zustand = 'laeuft';
      aussetzer.melden({ art: 'ende', dauerMs: luecke });
    }
    takte.melden(nachricht.mono);
  };

  return {
    start() {
      if (zustand === 'laeuft' || zustand === 'aussetzer') {
        return;
      }
      let neu: WorkerVerbindung;
      try {
        neu = erzeugeWorker();
      } catch {
        zustand = 'aus';
        fehlerSetzen();
        return;
      }
      worker = neu;
      zustand = 'laeuft';
      letzterTakt = zeitgeber.jetzt();
      neu.beiNachricht(empfangen);
      neu.beiFehler(fehlerSetzen);
      neu.senden({ art: 'start', taktMs: TAKT_MS });
      wacheAbbrechen = zeitgeber.wiederholen(wache, WACHE_MS);
    },
    stop() {
      aufraeumen();
      zustand = 'aus';
    },
    onTakt: (fn) => takte.an(fn),
    onWeckruf: (fn) => weckrufe.an(({ id, mono }) => fn(id, mono)),
    onAussetzer: (fn) => aussetzer.an(fn),
    onFehler: (fn) => fehler.an(() => fn()),
    wecken(id, inMs) {
      if (!worker || (zustand !== 'laeuft' && zustand !== 'aussetzer')) {
        return false;
      }
      worker.senden({ art: 'weckenUm', id, inMs });
      return true;
    },
    abbrechen(id) {
      worker?.senden({ art: 'abbrechen', id });
    },
    zustand: () => zustand,
  };
}

function browserWorker(): WorkerVerbindung {
  // Muster wörtlich lassen: Vite erkennt nur diese Form und gibt den Worker als eigenes Asset gleicher Herkunft aus.
  const worker = new Worker(new URL('./takt.worker.ts', import.meta.url), { type: 'module' });
  return {
    senden: (nachricht) => worker.postMessage(nachricht),
    beenden: () => worker.terminate(),
    beiNachricht: (fn) => {
      worker.onmessage = (ereignis: MessageEvent) => fn(ereignis.data);
    },
    beiFehler: (fn) => {
      worker.onerror = () => fn();
      worker.onmessageerror = () => fn();
    },
  };
}

/** Taktquelle mit echtem Worker (Browser). */
export function erzeugeBrowserTaktQuelle(): TaktQuelle {
  return erzeugeTaktQuelle({ erzeugeWorker: browserWorker, zeitgeber: echterZeitgeber });
}
