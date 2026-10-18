/**
 * Farben und Maße des Zustands-Abzeichens (Aufgabe 1.1 Spielanzeige, Mockup `karte-handy.html`): nur Tokens.
 * Pausen-Zustände in Warn-Orange, Live im eigenen Live-Rot, Verlängerung und Strafstoßschießen auf neutraler Fläche mit
 * Rahmen, Ende und ausgefallen gedämpft. Das Wort trägt die Bedeutung, nie die Farbe allein.
 */
import type { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displayLayout, type MonitorThemeColors } from '../../../design-tokens';
import type { MatchBadgeState } from '../../../core/view/badge';

export type MatchStatusBadgeSize = 'card' | 'row' | 'display';

/** Farben für Monitor-Themes; ohne sie gelten die Farben der App (cssVars). */
export interface MatchStatusBadgeTone {
  liveBg: string;
  liveFg: string;
  neutralBg: string;
  neutralFg: string;
}

/** Farben des Abzeichens in einem Monitor-Theme: Live im Live-Rot, alle übrigen Zustände auf der neutralen Fläche. */
export function monitorBadgeTone(theme: Pick<MonitorThemeColors, 'liveBadgeFill' | 'liveBadgeOn' | 'border' | 'text'>): MatchStatusBadgeTone {
  return { liveBg: theme.liveBadgeFill, liveFg: theme.liveBadgeOn, neutralBg: theme.border, neutralFg: theme.text };
}

export interface BadgeColors {
  bg: string;
  fg: string;
  border?: string;
}

export function badgeColors(state: MatchBadgeState): BadgeColors {
  const c = cssVars.colors;
  switch (state) {
    case 'live':
      return { bg: c.statusLive, fg: c.statusLiveOn };
    case 'pause':
    case 'halftime':
      return { bg: c.warningSolid, fg: c.onWarning };
    case 'overtime':
    case 'shootout':
      return { bg: c.surfaceLight, fg: c.textPrimary, border: c.borderControl };
    case 'ended':
    case 'cancelled':
      return { bg: c.statusFinishedBg, fg: c.textSecondary };
  }
}

export function badgeColorsFor(state: MatchBadgeState, tone: MatchStatusBadgeTone | undefined): BadgeColors {
  if (tone === undefined) {
    return badgeColors(state);
  }
  return state === 'live' ? { bg: tone.liveBg, fg: tone.liveFg } : { bg: tone.neutralBg, fg: tone.neutralFg };
}

const scoreArea = displayLayout.scoreArea;

export function badgeStyle(state: MatchBadgeState, size: MatchStatusBadgeSize, tone: MatchStatusBadgeTone | undefined): CSSProperties {
  const colors = badgeColorsFor(state, tone);
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: colors.bg,
    color: colors.fg,
    border: colors.border === undefined ? undefined : `${cssVars.borderWidth.thin} solid ${colors.border}`,
    fontWeight: cssVars.fontWeights.bold,
    whiteSpace: 'nowrap',
  };
  if (size === 'display') {
    return {
      ...base,
      gap: scoreArea.badgeGap,
      padding: `${scoreArea.badgePadY} ${scoreArea.badgePadX}`,
      borderRadius: cssVars.borderRadius.md,
      fontSize: displayFontSizes.liveBadge,
      width: '100%', // füllt die feste Breite der Monitor-Kopfzeile (`scoreArea.badgeWidth`)
      boxSizing: 'border-box',
    };
  }
  return {
    ...base,
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${size === 'row' ? cssVars.spacing.xs : cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    lineHeight: cssVars.lineHeights.bodySm,
  };
}

/** Puls-Punkt des Live-Abzeichens (Farbe der Schrift, damit er auf jeder Fläche sichtbar bleibt). */
export function dotStyle(size: MatchStatusBadgeSize, fg: string): CSSProperties {
  return {
    width: size === 'display' ? scoreArea.badgeDot : cssVars.spacing.sm,
    height: size === 'display' ? scoreArea.badgeDot : cssVars.spacing.sm,
    borderRadius: cssVars.borderRadius.full,
    background: fg,
    flexShrink: 0,
  };
}
