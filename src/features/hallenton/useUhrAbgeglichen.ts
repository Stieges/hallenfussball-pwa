/**
 * useUhrAbgeglichen (H4-12, @HT-036): wurde die Uhr dieses Geräts schon einmal mit dem Server abgeglichen (`ClockSync.isKnown` über die Engine)?
 * Nur lesend; neu gelesen, wenn die Engine etwas meldet, und alle 5 s, solange sie noch „nein“ sagt (der erste Abgleich läuft im Hintergrund).
 * Ohne Engine (Kontext fehlt) gilt die Uhr als abgeglichen – kein Hinweis aus Unwissen. Die Engine-Doppel der Tests haben `clockSynced`.
 */
import { useEffect, useState } from 'react';
import { useMatchEngineContextOptional } from '../match-engine/useMatchEngineContext';

const NEU_LESEN_MS = 5000;

export function useUhrAbgeglichen(): boolean {
  const engine = useMatchEngineContextOptional()?.engine ?? null;
  const [abgeglichen, setAbgeglichen] = useState<boolean>(() => engine?.clockSynced() ?? true);

  useEffect(() => {
    if (engine === null) {
      setAbgeglichen(true);
      return undefined;
    }
    const lies = (): void => { setAbgeglichen(engine.clockSynced()); };
    lies();
    const abmelden = engine.subscribe(lies);
    const takt = window.setInterval(lies, NEU_LESEN_MS);
    return () => {
      abmelden();
      window.clearInterval(takt);
    };
  }, [engine]);

  return abgeglichen;
}
