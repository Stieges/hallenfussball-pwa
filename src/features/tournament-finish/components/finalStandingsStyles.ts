/**
 * Gestaltung des Endstand-Blocks in der App (R3-5): nur Design-Tokens. Platz 1 wird ohne neue Farbe hervorgehoben (Fläche
 * `primaryLight`, Rand `primary`); Gold (`medalGold`) nur auf der Zuschauer-Seite (R3-6) und nur für Platz 1 (Turniersieger).
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { placeNumber, placeRow } from './finishStyles';

export { placeNumber };

/** Platz, Team und – wenn die Zeilen Tabellenwerte tragen (R3-5b) – Spalten Sp, Diff, Pkt in fester Breite (Zahlen rechtsbündig). */
/** Schmaler als `spacing.xl`, damit ein 50-Zeichen-Name auf dem 360-px-Handy neben den drei Spalten Platz hat. */
const valueColumns = `repeat(3, calc(${cssVars.spacing.xl} - ${cssVars.spacing.xs}))`;
const rowColumns = (withValues: boolean): string =>
  `${cssVars.spacing.xl} minmax(0, 1fr)${withValues ? ` ${valueColumns}` : ''}`;
export const standingsRow = (withValues: boolean): CSSProperties => ({
  ...placeRow, gridTemplateColumns: rowColumns(withValues), minHeight: cssVars.touchTargets.primary,
});
export const standingsHeader = (withValues: boolean): CSSProperties => ({
  display: 'grid', gridTemplateColumns: rowColumns(withValues), gap: cssVars.spacing.sm, padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textSecondary,
});
export const valueCell: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
export const pointsCell: CSSProperties = { ...valueCell, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
export const standingsRowFirst: CSSProperties = {
  background: cssVars.colors.primaryLight, borderLeft: `${cssVars.borderWidth.medium} solid ${cssVars.colors.primary}`,
};
/** Torschützen: Rang, Name, Tore – die Tore rutschen bei schmaler Spalte unter den Namen, statt ihn mitten im Wort zu trennen. */
export const scorerRow: CSSProperties = {
  ...placeRow, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: cssVars.spacing.sm, minHeight: cssVars.touchTargets.minimum,
};
export const scorerRank: CSSProperties = { ...placeNumber, width: cssVars.spacing.xl, flex: 'none' };
/** Grundbreite des Namens: reicht sie neben Rang und Tore nicht, stehen die Tore in der nächsten Zeile (Name bricht nur an Leerzeichen). */
export const scorerName: CSSProperties = { flex: `1 1 calc(${cssVars.spacing.xxl} * 4)`, minWidth: 0 };
export const scorerGoals: CSSProperties = { flex: 'none', marginLeft: 'auto', whiteSpace: 'nowrap' };

export const winnerCard: CSSProperties = {
  display: 'grid', gridTemplateColumns: `${cssVars.iconSizes.xl} minmax(0, 1fr)`, gap: cssVars.spacing.md, alignItems: 'center',
  padding: cssVars.spacing.md, background: cssVars.colors.primaryLight, border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.primary}`,
  borderRadius: cssVars.borderRadius.lg, minWidth: 0,
};
export const winnerName: CSSProperties = {
  margin: 0, fontSize: cssVars.fontSizes.xxl, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary, overflowWrap: 'anywhere',
};
export const badge: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, borderRadius: cssVars.borderRadius.full,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textSecondary,
};

/** Zuschauer-Seite (R3-6): Platz 1 in Gold – Rand und Pokal; Fläche bleibt die neutrale. */
export const goldWinnerCard: CSSProperties = { ...winnerCard, background: cssVars.colors.surface, border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.medalGold}` };
export const goldTrophy: CSSProperties = { display: 'inline-flex', color: cssVars.colors.medalGold };
/** Innenschatten statt Rand: der Name in Zeile 1 steht auf derselben Kante wie in den übrigen Zeilen (Review #405 m-2). */
export const goldRowFirst: CSSProperties = { boxShadow: `inset ${cssVars.borderWidth.medium} 0 0 ${cssVars.colors.medalGold}` };
