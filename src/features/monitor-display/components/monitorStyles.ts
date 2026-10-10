import type { CSSProperties } from 'react';
import { displayColors } from '../../../design-tokens';

/** Vollflächiger Rahmen der Monitor-Seite (auch für Lade- und Fehlerzustand). */
export const containerStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: displayColors.background,
  color: displayColors.textPrimary,
  // eslint-disable-next-line local-rules/no-hardcoded-font-styles -- Monitor-Schrift Inter; kein Token mit gleichem Wert (B-16d2, Verschiebung)
  fontFamily: 'Inter, system-ui, sans-serif',
};
