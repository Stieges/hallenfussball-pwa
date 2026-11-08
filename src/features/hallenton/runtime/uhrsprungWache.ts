/**
 * Uhrsprung-Wache der Lautsprecher-Laufzeit (H3b-2b, @HT-010, W1): misst je Takt den Sprung der Geräteuhr gegen die stetige
 * Uhr (`uhrsprungMs`) und gleicht danach mit dem Server ab (`sync()`); solange der Abgleich läuft, meldet sie keinen weiteren
 * Sprung und die Laufzeit plant nicht.
 */
import { uhrsprungMs, type UhrProbe } from '../../../core/hallenton';

export interface UhrsprungWache {
  /** Sprung seit dem letzten Takt (ms) oder `null`; ändert nur die Probe. */
  messen(): number | null;
  /** Nach einem Sprung: `sync()` starten. */
  abgleichen(): void;
  syncLaeuft(): boolean;
}

export function erzeugeUhrsprungWache(probeNehmen: () => UhrProbe, uhr: { sync(): Promise<unknown> }): UhrsprungWache {
  let probe: UhrProbe | null = null;
  let laeuft = false;
  return {
    messen() {
      const jetzt = probeNehmen();
      const sprung = probe === null || laeuft ? null : uhrsprungMs(probe, jetzt);
      probe = jetzt;
      return sprung;
    },
    abgleichen() {
      laeuft = true;
      void uhr.sync().catch(() => undefined).finally(() => {
        laeuft = false;
        probe = probeNehmen();
      });
    },
    syncLaeuft: () => laeuft,
  };
}
