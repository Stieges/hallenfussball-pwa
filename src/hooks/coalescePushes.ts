/**
 * A-08f3b2-F (Review I-1, @FU-087): Bündelt Realtime-Pushes eines Turniers. Ein volles Speichern erzeugt viele
 * Zeilen-Ereignisse (Turnier mit 8 Teams und 30 Spielen: rund 38); ohne Bündelung löste jedes ein eigenes frisches
 * Lesen aus (Egress). Debounce mit Max-Wait: `fn` läuft PUSH_COALESCE_DEBOUNCE_MS nach dem letzten Ereignis,
 * bei Dauerfeuer spätestens PUSH_COALESCE_MAX_WAIT_MS nach dem ersten offenen Ereignis -- so bleibt die Anzeige
 * bei offenem Kanal in ≤ 3 s (@FU-087). Gleichzeitige Lesungen bündelt danach die Single-Flight-Logik im Repository.
 */

export const PUSH_COALESCE_DEBOUNCE_MS = 300;
export const PUSH_COALESCE_MAX_WAIT_MS = 1000;

export interface PushCoalescer {
  trigger: () => void;
  cancel: () => void;
}

export function createPushCoalescer(
  fn: () => void,
  debounceMs: number = PUSH_COALESCE_DEBOUNCE_MS,
  maxWaitMs: number = PUSH_COALESCE_MAX_WAIT_MS,
): PushCoalescer {
  // Zwei Zeitgeber statt Date.now(): bleibt mit gefälschten Zeitgebern in Tests konsistent.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

  const clear = (): void => {
    if (debounceTimer !== null) { clearTimeout(debounceTimer); }
    if (maxWaitTimer !== null) { clearTimeout(maxWaitTimer); }
    debounceTimer = null;
    maxWaitTimer = null;
  };
  const flush = (): void => {
    clear();
    fn();
  };

  return {
    trigger: () => {
      if (debounceTimer !== null) { clearTimeout(debounceTimer); }
      debounceTimer = setTimeout(flush, debounceMs);
      maxWaitTimer ??= setTimeout(flush, maxWaitMs);
    },
    cancel: clear,
  };
}
