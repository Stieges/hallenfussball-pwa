import type { CSSProperties } from 'react';
import { displayColors, displayMonitor } from '../../../design-tokens';

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
  fontFamily: displayMonitor.fontStack,
};
