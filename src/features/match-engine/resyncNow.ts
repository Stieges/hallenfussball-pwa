/**
 * resyncNow (Brief A8, @FU-015): ein einziger Weg, um nach Rueckkehr (Sichtbarkeit, Knopf,
 * Sync-Anzeige) alles nachzuziehen. Framework-frei.
 *
 * Alle Teilschritte starten GLEICHZEITIG, keiner wartet auf einen anderen. Jeder Teilschritt
 * ist einzeln gekapselt (synchroner Wurf UND Ablehnung) und bricht still ab. Die Rueckgabe
 * lehnt nie ab; Aufrufer schreiben `void resyncNow(...)`.
 */

export interface ResyncParts {
  clock: { sync(): Promise<unknown> };
  sender: { kick(): Promise<void> };
  engine: { catchUpLoaded(): Promise<void> };
  mutationQueue: { processIfDue(): Promise<void> } | null;
  isGuest: boolean;
}

/** Startet einen Teilschritt; ein Wurf oder eine Ablehnung wird still verschluckt. */
function runStep(step: () => Promise<unknown>): Promise<void> {
  try {
    return step().then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

export function resyncNow(parts: ResyncParts): Promise<void> {
  const steps: Promise<void>[] = [];
  if (!parts.isGuest) {
    steps.push(runStep(() => parts.clock.sync()));
    steps.push(runStep(() => parts.sender.kick()));
    steps.push(runStep(() => parts.engine.catchUpLoaded()));
  }
  const queue = parts.mutationQueue;
  if (queue !== null) {
    steps.push(runStep(() => queue.processIfDue()));
  }
  return Promise.allSettled(steps).then(() => undefined);
}
