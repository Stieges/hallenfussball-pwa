/**
 * Kern des Takt-Workers (H3b-1): nur Zeitgeber, keine Logik (Plan H3b: „Die Logik bleibt im Hauptthread“).
 * Getrennt von `takt.worker.ts`, damit er ohne echten Worker prüfbar ist (`src/test/hallenton/falscheTaktQuelle.ts`).
 *
 * An den Worker:  { art: 'start', taktMs } | { art: 'stop' } | { art: 'weckenUm', id, inMs } | { art: 'abbrechen', id }
 * Vom Worker:     { art: 'takt', mono }    | { art: 'weckruf', id, mono }
 * Ein neuer Weckruf unter derselben Kennung ersetzt den alten; `stop` beendet Takt und alle Weckrufe.
 */
import type { Zeitgeber } from './zeitgeber';

export type AnTaktWorker =
  | { art: 'start'; taktMs: number }
  | { art: 'stop' }
  | { art: 'weckenUm'; id: string; inMs: number }
  | { art: 'abbrechen'; id: string };

export type VomTaktWorker =
  | { art: 'takt'; mono: number }
  | { art: 'weckruf'; id: string; mono: number };

export interface TaktWorkerScope {
  senden(nachricht: VomTaktWorker): void;
  beiNachricht(fn: (daten: unknown) => void): void;
}

function alsNachricht(daten: unknown): AnTaktWorker | null {
  if (!daten || typeof daten !== 'object') {
    return null;
  }
  const n = daten as { art?: unknown; taktMs?: unknown; id?: unknown; inMs?: unknown };
  switch (n.art) {
    case 'start':
      return typeof n.taktMs === 'number' && n.taktMs > 0 ? { art: 'start', taktMs: n.taktMs } : null;
    case 'stop':
      return { art: 'stop' };
    case 'weckenUm':
      return typeof n.id === 'string' && typeof n.inMs === 'number' ? { art: 'weckenUm', id: n.id, inMs: n.inMs } : null;
    case 'abbrechen':
      return typeof n.id === 'string' ? { art: 'abbrechen', id: n.id } : null;
    default:
      return null;
  }
}

export function verbindeTaktWorker(scope: TaktWorkerScope, zeit: Zeitgeber): void {
  let taktAbbrechen: (() => void) | null = null;
  const weckrufe = new Map<string, () => void>();

  const abbrechen = (id: string): void => {
    weckrufe.get(id)?.();
    weckrufe.delete(id);
  };

  scope.beiNachricht((daten) => {
    const nachricht = alsNachricht(daten);
    if (!nachricht) {
      return;
    }
    switch (nachricht.art) {
      case 'start':
        taktAbbrechen?.();
        taktAbbrechen = zeit.wiederholen(() => scope.senden({ art: 'takt', mono: zeit.jetzt() }), nachricht.taktMs);
        break;
      case 'stop':
        taktAbbrechen?.();
        taktAbbrechen = null;
        for (const id of [...weckrufe.keys()]) {
          abbrechen(id);
        }
        break;
      case 'weckenUm':
        abbrechen(nachricht.id);
        weckrufe.set(nachricht.id, zeit.spaeter(() => {
          weckrufe.delete(nachricht.id);
          scope.senden({ art: 'weckruf', id: nachricht.id, mono: zeit.jetzt() });
        }, Math.max(0, nachricht.inMs)));
        break;
      case 'abbrechen':
        abbrechen(nachricht.id);
        break;
    }
  });
}
