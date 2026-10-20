/**
 * usePrefersReducedMotion – hat das Gerät „Bewegung reduzieren“ eingestellt (Plan LT-3, K12, @SL-156)?
 * Mit Abo auf Änderungen; ohne `matchMedia` (alte Umgebung, Tests) gilt „nein“.
 */
import { useEffect, useState } from 'react';

const ABFRAGE = '(prefers-reduced-motion: reduce)';

function aktuell(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(ABFRAGE).matches : false;
}

export function usePrefersReducedMotion(): boolean {
  const [reduziert, setReduziert] = useState(aktuell);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') { return undefined; }
    const abfrage = window.matchMedia(ABFRAGE);
    const bei = (e: { matches: boolean }) => { setReduziert(e.matches); };
    setReduziert(abfrage.matches);
    abfrage.addEventListener('change', bei);
    return () => { abfrage.removeEventListener('change', bei); };
  }, []);
  return reduziert;
}
