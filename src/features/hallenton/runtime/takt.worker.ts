/**
 * Dedicated Worker des Hallen-Lautsprechers (H3b-1): Takt und Weckrufe, die im Hintergrund nicht gedrosselt werden
 * (Spike 06.11., Abschnitt 3.5 und 5). Eigene Datei gleicher Herkunft (CSP `worker-src 'self'`, kein `blob:`), eingebunden
 * in `taktQuelle.ts` per `new Worker(new URL('./takt.worker.ts', import.meta.url), { type: 'module' })`.
 */
import { verbindeTaktWorker } from './taktWorkerKern';
import { echterZeitgeber } from './zeitgeber';

/** Ausschnitt von `DedicatedWorkerGlobalScope` (die DOM-Typen des Projekts kennen nur `Window` als `self`). */
interface WorkerGlobal {
  postMessage(nachricht: unknown): void;
  addEventListener(type: 'message', fn: (ereignis: MessageEvent) => void): void;
}

const scope = self as unknown as WorkerGlobal;

verbindeTaktWorker({
  senden: (nachricht) => scope.postMessage(nachricht),
  beiNachricht: (fn) => scope.addEventListener('message', (ereignis) => fn(ereignis.data)),
}, echterZeitgeber);
