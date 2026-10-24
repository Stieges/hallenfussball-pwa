/**
 * useCockpitStufe – Stufe der Maße nach Fensterhöhe (Plan Cockpit v2 3.4, @SL-187, F5).
 *
 * `knapp` (unter 720 px, dort auch Variante a: Name nur in der Leiste), `normal` (720 bis 799 px), `gross` (ab 800 px).
 * Die Schwellen kommen aus `cockpitHeightSteps` (Token). Gilt nur im Layout `breit`; die Hülle schreibt das Ergebnis als `data-stufe`.
 */
import { useEffect, useState } from 'react';
import { cockpitHeightSteps } from '../../../design-tokens';

export type CockpitStufe = 'knapp' | 'normal' | 'gross';

/** Rein: die Stufe zu einer Fensterhöhe. */
export function stufeFuerHoehe(hoehe: number): CockpitStufe {
  if (hoehe < cockpitHeightSteps.knapp) { return 'knapp'; }
  return hoehe < cockpitHeightSteps.gross ? 'normal' : 'gross';
}

const aktuelleHoehe = (): number => (typeof window === 'undefined' ? cockpitHeightSteps.gross : window.innerHeight);

export function useCockpitStufe(): CockpitStufe {
  const [hoehe, setHoehe] = useState<number>(aktuelleHoehe);
  useEffect(() => {
    const beiAenderung = (): void => { setHoehe(window.innerHeight); };
    beiAenderung();
    window.addEventListener('resize', beiAenderung, { passive: true });
    window.addEventListener('orientationchange', beiAenderung);
    return () => {
      window.removeEventListener('resize', beiAenderung);
      window.removeEventListener('orientationchange', beiAenderung);
    };
  }, []);
  return stufeFuerHoehe(hoehe);
}
