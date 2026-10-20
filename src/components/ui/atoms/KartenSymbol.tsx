/**
 * KartenSymbol – kleines Karten-Rechteck in Kartenfarbe (ersetzt die Farb-Emojis in Verläufen, Listen, Dialogen).
 * Farben nur aus `cardYellow`/`cardRed` (Oberfläche E, „Karten-Farben nur für Karten“); dekorativ, der Text daneben benennt die Karte.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import type { CardKind } from '../../../utils/cardKind';
import { kartenFlaecheStil } from './kartenFlaeche';

export interface KartenSymbolProps {
  art: CardKind;
}

export function KartenSymbol({ art }: KartenSymbolProps) {
  const style: CSSProperties = {
    ...kartenFlaecheStil(art),
    display: 'inline-block',
    verticalAlign: 'middle',
    height: cssVars.iconSizes.md,
    aspectRatio: '3 / 4',
    boxSizing: 'border-box',
    flexShrink: 0,
  };
  return <span aria-hidden="true" data-testid={`karten-symbol-${art}`} style={style} />;
}

export default KartenSymbol;
