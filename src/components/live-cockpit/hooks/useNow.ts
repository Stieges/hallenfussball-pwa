import { useEffect, useState } from 'react';

/**
 * Jetzt in ms aus einem Takt (kein `Date.now()` im Render). Ohne `intervalMs` (`null`) steht der Wert still: die Tafel
 * braucht ihn nur vor dem Anpfiff („überfällig N Min“ (@OB-068)), dort reicht ein Takt von 30 Sekunden.
 */
export function useNow(intervalMs: number | null): number {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs === null) { return undefined; }
    setJetzt(Date.now());
    const timer = setInterval(() => { setJetzt(Date.now()); }, intervalMs);
    return () => { clearInterval(timer); };
  }, [intervalMs]);
  return jetzt;
}
