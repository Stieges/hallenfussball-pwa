/**
 * Ist das Fenster schmaler als `breakpoints.mobile` (480 px)? Die Statuszeile nimmt dann bei zwei und mehr Einträgen die Kurzform
 * (@HT-045). Reagiert auf Größenänderungen; ohne `matchMedia` (z. B. Server) gilt „breit“.
 */
import { useEffect, useState } from 'react';
import { breakpointValues } from '../../../design-tokens';

const ABFRAGE = `(max-width: ${breakpointValues.mobile - 1}px)`;

function passt(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(ABFRAGE).matches;
}

export function useSchmaleBreite(): boolean {
  const [schmal, setSchmal] = useState(passt);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') { return; }
    const mq = window.matchMedia(ABFRAGE);
    const wechsel = (e: MediaQueryListEvent) => setSchmal(e.matches);
    setSchmal(mq.matches);
    mq.addEventListener('change', wechsel);
    return () => mq.removeEventListener('change', wechsel);
  }, []);
  return schmal;
}
