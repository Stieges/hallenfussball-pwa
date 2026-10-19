/**
 * kartenFlaecheStil – Fläche eines Karten-Symbols im Cockpit (Kartenart-Schritt, Rückfrage, Kartendialog).
 * Gelb und Rot nur aus den Karten-Tokens (`cardYellow`, `cardRed`), nie aus `warning`/`error` (Record Oberfläche: „Karten-Farben nur für
 * Karten“, Befund C-KARTE-GELB-ALS-WARNFARBE). Dünner Rand aus `borderControl` (Grafik-Kontrast ≥ 3 : 1), damit auch das Gelb auf Weiß als
 * Form erkennbar ist. Gelb-Rot ist diagonal aus beiden geteilt.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import type { CardKind } from '../model/cockpitTypes';

const FLAECHE: Record<CardKind, string> = {
  YELLOW: cssVars.colors.cardYellow,
  YELLOW_RED: `linear-gradient(135deg, ${cssVars.colors.cardYellow} 50%, ${cssVars.colors.cardRed} 50%)`,
  RED: cssVars.colors.cardRed,
};

export function kartenFlaecheStil(art: CardKind): CSSProperties {
  return {
    background: FLAECHE[art],
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.sm,
  };
}
