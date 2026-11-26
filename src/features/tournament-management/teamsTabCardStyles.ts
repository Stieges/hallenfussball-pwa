/**
 * Stile der Kartenkopfzeile und der Umbenennen-Zeile im Reiter „Teams“ (@OB-021): Name bricht um (nach „/“ über `<TeamName>`),
 * der Auf-/Zuklapp-Pfeil schrumpft nie und ist mindestens so groß wie eine Tippfläche, die Tastengruppe bricht um und bleibt in der Karte.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';

export const teamNameStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textPrimary,
  marginBottom: '4px',
  minWidth: 0,
  overflowWrap: 'anywhere',
};

/** Zeile aus Teamname und Gruppen-Abzeichen: bricht um, statt über den Pfeil zu laufen. */
export const teamNameRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, gap: cssVars.spacing.sm };

export const expandButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: cssVars.spacing.xs,
  color: cssVars.colors.primary,
  fontSize: cssVars.fontSizes.lg,
  transition: 'transform 0.2s ease',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: cssVars.touchTargets.minimum,
  minHeight: cssVars.touchTargets.minimum,
};

export const buttonGroupStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm, maxWidth: '100%' };

/** In der schmalen Kartenkopfzeile bleiben nur kurze Wörter mit Bindestrich („Rot-Weiß“) ganz; längere („Oberweiler-Niederstetten“) dürfen nach dem Bindestrich umbrechen, statt unter den Pfeil zu laufen. */
export const keepShortHyphenWord = (piece: string): boolean => /\p{L}-\p{L}/u.test(piece) && piece.length <= 10;
