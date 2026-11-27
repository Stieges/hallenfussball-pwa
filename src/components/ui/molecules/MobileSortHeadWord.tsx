/**
 * Inhalt eines Handy-Kopfes (nur Anzeige, @TS-003, Entscheidung 27.11.): das Wort steht oben, darunter eine immer vorhandene Pfeilreihe
 * fester Höhe (`iconSizes.xs`; ohne aria-hidden: die Reihe trägt keinen Text, die Sortierung sagt aria-sort am Kopf an). So stehen alle Wörter der Kopfzeile auf einer Linie, und die Kopfzeile ist mit und ohne Sortierung gleich hoch.
 * Der Pfeil steht nur bei Sortierung, zentriert unter dem Wort der gewählten Spalte; unsortiert (Platzierung) steht keiner.
 */
import type { ReactNode } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export function MobileSortHeadWord({ visual, arrow }: { visual: ReactNode; arrow: 'asc' | 'desc' | null }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span data-sort-word>{visual}</span>
      <span data-sort-arrow-row style={{ display: 'inline-flex', alignItems: 'center', height: cssVars.iconSizes.xs }}>
        {arrow === 'desc' ? <Icons.ArrowDown size={iconSizeValues.xs} /> : arrow === 'asc' ? <Icons.ArrowUp size={iconSizeValues.xs} /> : null}
      </span>
    </span>
  );
}
