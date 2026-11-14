/**
 * useUhrAbgeglichen (H4-12, @HT-036): wurde die Uhr dieses Geräts schon einmal mit dem Server abgeglichen (`ClockSync.isKnown` über die Engine)?
 * Nur lesend; neu gelesen, wenn die Engine etwas meldet, und alle 5 s, solange sie noch „nein“ sagt (der erste Abgleich läuft im Hintergrund).
 * Ohne Engine (Kontext fehlt) gilt die Uhr als abgeglichen – kein Hinweis aus Unwissen.
 */
import { useEffect, useState } from 'react';
import { useMatchEngineContextOptional } from '../match-engine/useMatchEngineContext';

const NEU_LESEN_MS = 5000;

type EngineMitUhr = { clockSynced?: () => boolean; subscribe?: (fn: () => void) => () => void };

/** Ein Engine-Doppel ohne `clockSynced` (ältere Tests, Teilkopien) gilt als abgeglichen: kein Hinweis aus Unwissen. */
function abgeglichenIn(engine: EngineMitUhr | null): boolean {
  return typeof engine?.clockSynced === 'function' ? engine.clockSynced() : true;
}

export function useUhrAbgeglichen(): boolean {
  const engine = useMatchEngineContextOptional()?.engine ?? null;
  const [abgeglichen, setAbgeglichen] = useState<boolean>(() => abgeglichenIn(engine));

  useEffect(() => {
    if (engine === null) {
      setAbgeglichen(true);
      return undefined;
    }
    const lies = (): void => { setAbgeglichen(abgeglichenIn(engine)); };
    lies();
    const abmelden = typeof engine.subscribe === 'function' ? engine.subscribe(lies) : () => undefined;
    const takt = window.setInterval(lies, NEU_LESEN_MS);
    return () => {
      abmelden();
      window.clearInterval(takt);
    };
  }, [engine]);

  return abgeglichen;
}
