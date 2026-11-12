/**
 * Stile des Live-Info-Felds (LiveInfoExpand): nur Tokens, keine festen Maße. Eigene Datei, damit die Komponente
 * unter der Größengrenze bleibt (reine Stilwerte, keine zweite Aufgabe).
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.md,
};

export const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

export const scoreContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: cssVars.spacing.md,
  padding: cssVars.spacing.md,
  backgroundColor: cssVars.colors.surfaceLight,
  borderRadius: cssVars.borderRadius.md,
};

export const teamScoreStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  // Beide Seiten teilen die Breite; lange Namen brechen um, statt die Fläche zu sprengen (kein festes Maß)
  flex: '1 1 0',
  minWidth: 0,
};

export const teamNameStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textSecondary,
  textAlign: 'center',
  // MOBILE-UX: No truncation - team names must be fully visible
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
};

export const scoreValueStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xxxl,
  fontWeight: cssVars.fontWeights.extrabold,
  color: cssVars.colors.textPrimary,
  lineHeight: 1,
};

export const scoreSeparatorStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xxl,
  fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textSecondary,
};

export const eventsContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.xs,
};

export const eventsHeaderStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xs,
  color: cssVars.colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: cssVars.letterSpacing.wider,
};

export const eventItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  padding: cssVars.spacing.xs,
  fontSize: cssVars.fontSizes.sm,
};

export const eventIconStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.md,
  flexShrink: 0,
};

export const eventTextStyle: CSSProperties = {
  flex: 1,
  color: cssVars.colors.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const eventTimeStyle: CSSProperties = {
  color: cssVars.colors.textSecondary,
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
};

export const noEventsStyle: CSSProperties = {
  textAlign: 'center',
  padding: cssVars.spacing.sm,
  color: cssVars.colors.textMuted,
  fontSize: cssVars.fontSizes.sm,
};

export const actionsStyle: CSSProperties = {
  display: 'flex',
  // Tasten brechen in die nächste Zeile um, statt aus dem Bild zu laufen (@OB-021, Befund C-LIVEINFO-TASTEN-AUS-DEM-BILD)
  flexWrap: 'wrap',
  gap: cssVars.spacing.sm,
  justifyContent: 'flex-end',
  paddingTop: cssVars.spacing.sm,
  borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
};


/** Jede Taste darf schmaler als ihr Wort werden (das Wort bricht um) und nie breiter als die Zeile sein. */
export const actionButtonStyle: CSSProperties = { minWidth: 0, maxWidth: '100%' };
