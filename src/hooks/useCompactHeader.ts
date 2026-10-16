/**
 * useCompactHeader – true unter `breakpoints.compactHeader` (400 px), reagiert auf Größenänderungen.
 * @OB-021: Unter dieser Breite zeigt die Kopfzeile Marken nur als Symbol, damit sie bei 360–390 px ohne Überlauf passt.
 */
import { useEffect, useState } from 'react';
import { breakpointValues } from '../design-tokens';

const ABFRAGE = `(max-width: ${breakpointValues.compactHeader - 1}px)`;

function passt(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(ABFRAGE).matches;
}

export function useCompactHeader(): boolean {
  const [kompakt, setKompakt] = useState(passt);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') { return; }
    const mq = window.matchMedia(ABFRAGE);
    const wechsel = (e: MediaQueryListEvent) => setKompakt(e.matches);
    setKompakt(mq.matches);
    mq.addEventListener('change', wechsel);
    return () => mq.removeEventListener('change', wechsel);
  }, []);
  return kompakt;
}
