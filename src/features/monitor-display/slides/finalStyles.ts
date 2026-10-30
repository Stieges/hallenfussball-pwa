/**
 * Stile der Folien „Endstand“ und „Torschützen“ am Monitor (R3-7): Zeilenkasten, Platzspalte, Siegerrahmen in Gold (nur Platz 1).
 * Nur Tokens (`displayFinal`, `displayList`, `monitorThemes`); Größen in vh, damit der Anteil an der Bildhöhe bei jeder Auflösung gleich bleibt.
 */
import type { CSSProperties } from 'react';
import { cssVars, displayFinal, displayList, displayMonitor, monitorThemes } from '../../../design-tokens';

export type FinalThemeColors = (typeof monitorThemes)[keyof typeof monitorThemes];

export const finalColumn: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: displayFinal.rowGap, width: '100%',
};

export const finalSubtitle = (colors: FinalThemeColors): CSSProperties => ({
  fontSize: displayFinal.fontSizes.subtitle, color: colors.text, marginTop: displayFinal.subtitleGap, marginBottom: displayFinal.headingGapBelow,
  textAlign: 'center', overflowWrap: 'break-word', maxWidth: '100%',
});

export const finalHeadingBlock: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' };

/** Zeilenkasten: Platz | Name | Rest; Platz 1 mit Goldrahmen (Rahmen in `box-shadow: inset`, damit die Zeilen gleich breit bleiben). */
export function finalRow(colors: FinalThemeColors, goldColor: string | null): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `${displayFinal.placeWidth} minmax(0, 1fr) auto`,
    alignItems: 'center',
    gap: displayList.cellGap,
    width: '100%',
    boxSizing: 'border-box',
    padding: `${displayFinal.rowPaddingY} ${displayList.rowPaddingX}`,
    background: colors.surface,
    borderRadius: displayMonitor.radius.card,
    border: `${cssVars.borderWidth.thin} solid ${colors.border}`,
    boxShadow: goldColor === null ? undefined : `inset 0 0 0 ${displayFinal.winnerBorderWidth} ${goldColor}`,
    fontSize: displayFinal.fontSizes.row,
    lineHeight: displayFinal.rowLineHeight,
    color: colors.text,
  };
}

export const finalPlace = (colors: FinalThemeColors): CSSProperties => ({
  fontWeight: cssVars.fontWeights.bold, color: colors.text, fontVariantNumeric: 'tabular-nums',
});

export const finalName: CSSProperties = { minWidth: 0, overflowWrap: 'break-word', fontWeight: cssVars.fontWeights.bold };

/** Kindermodus: der Satz groß in der Mitte, nie ein Platz. */
export const finalKids: CSSProperties = {
  fontSize: displayFinal.fontSizes.kids, fontWeight: cssVars.fontWeights.bold, textAlign: 'center', overflowWrap: 'break-word', maxWidth: '100%',
};
