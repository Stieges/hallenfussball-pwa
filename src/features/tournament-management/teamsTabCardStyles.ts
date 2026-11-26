/**
 * Stile der Kartenkopfzeile und der Umbenennen-Zeile im Reiter „Teams“ (@OB-021): Name bricht um (nach „/“ über `<TeamName>`),
 * der Auf-/Zuklapp-Pfeil schrumpft nie und ist mindestens so groß wie eine Tippfläche, die Tastengruppe bricht um und bleibt in der Karte.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';

/** Umbruch an Leerzeichen und nach „/“; Wörter mit Bindestrich bleiben ganz. Nur ein einzelnes Wort, das länger ist als die Zeile, bricht als letzte Möglichkeit an beliebiger Stelle (@ZM-207). */
export const teamNameStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textPrimary,
  marginBottom: cssVars.spacing.xs,
  minWidth: 0,
  overflowWrap: 'anywhere',
};

/** Zeile aus Teamname und (am Tablet/Desktop) Gruppen-Abzeichen: bricht um, statt über den Pfeil zu laufen. */
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

export const badgeStyle = (color: string, bgColor: string): CSSProperties => ({
  fontSize: cssVars.fontSizes.xs,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.sm,
  background: bgColor,
  color,
  fontWeight: cssVars.fontWeights.medium,
});

export const teamCardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: cssVars.spacing.md,
  gap: cssVars.spacing.md,
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
};

export const teamCardLeftStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.md, flex: 1, minWidth: 0 };

/** Meta-Zeile (Abzeichen am Handy, Farbpunkt, Ergebnisse, geplant): Angaben brechen untereinander um, jede Angabe bleibt ganz. */
export const teamCardMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: cssVars.spacing.xs,
  columnGap: cssVars.spacing.sm,
  fontSize: cssVars.fontSizes.xs,
  color: cssVars.colors.textSecondary,
};

export const metaItemStyle: CSSProperties = { whiteSpace: 'nowrap' };

/** Am Handy: Kopf als Spalte – oben Logo, Meta-Zeile und Pfeil, darunter der Name über die volle Breite (ein langes Wort passt, kein Wortbruch). */
export const teamCardHeaderMobileStyle: CSSProperties = { ...teamCardHeaderStyle, flexDirection: 'column', alignItems: 'stretch', gap: cssVars.spacing.sm, minHeight: 0 };
export const teamCardTopRowMobileStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.md, minWidth: 0 };
