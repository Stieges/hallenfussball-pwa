/**
 * Ist das Fenster schmaler als das Blatt-Token (`breakpointValues.sheet`, 600 px)? Dort ist der Abschluss-Dialog ein Vollbild mit
 * festem Fuß (Daniel 25.10.), darüber ein zentrierter Dialog. Die Größenänderung wird verfolgt.
 */
import { useEffect, useState } from 'react';
import { breakpointValues } from '../../../design-tokens';

const query = (): boolean => typeof window !== 'undefined' && window.innerWidth < breakpointValues.sheet;

export function useBelowSheetWidth(): boolean {
  const [below, setBelow] = useState<boolean>(query);
  useEffect(() => {
    const onResize = (): void => { setBelow(query()); };
    onResize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); };
  }, []);
  return below;
}
