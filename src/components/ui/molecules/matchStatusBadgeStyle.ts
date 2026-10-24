/**
 * Farben und Maße des Zustands-Abzeichens (Aufgabe 1.1 Spielanzeige, Mockup `karte-handy.html`): nur Tokens.
 * Pausen-Zustände in Warn-Orange, Live im eigenen Live-Rot, Verlängerung und Strafstoßschießen auf neutraler Fläche mit
 * Rahmen, Ende und ausgefallen gedämpft. Das Wort trägt die Bedeutung, nie die Farbe allein.
 */
import type { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displayLayout, type MonitorThemeColors } from '../../../design-tokens';
import type { MatchBadgeState } from '../../../core/view/badge';

/** `tafel`: Kopfzeile der Laptop-Tafel (@SL-180), größer als die Spielkarte (`card`), damit „Live“ aus 1 bis 2 m zu lesen ist. */
export type MatchStatusBadgeSize = 'card' | 'row' | 'display' | 'tafel';

/**
 * Fläche, auf der das Abzeichen steht. `app`: Spielkarte, Verwaltung, Zuschauer (Standard). `scoreboard`: die immer
 * dunkle Cockpit-Tafel (@OB-065). Auf der Tafel tragen nur „Ende“ und „ausgefallen“ eigene Farben (Tafel-Schrift und
 * Rahmen), damit die Schrift auf der dunklen Fläche ≥ 4,5 : 1 bleibt; alle übrigen Zustände sind wie auf der Spielkarte.
 * `scoreboardFlach`: Laptop-Tafel (@SL-180) – „Live“ ohne rote Fläche (weiße Schrift, grüner Punkt), sonst wie `scoreboard`.
 */
export type MatchStatusBadgeSurface = 'app' | 'scoreboard' | 'scoreboardFlach';

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

/** Schrift der Anstoßzeit (geplantes Spiel): auf der dunklen Tafel die Tafel-Schrift, sonst textSecondary (@OB-065). */
export function kickoffColorFor(surface: MatchStatusBadgeSurface = 'app'): string {
  return surface !== 'app' ? cssVars.colors.scoreboardTextMuted : cssVars.colors.textSecondary;
}

/** Farben auf der Cockpit-Tafel: nur „Ende“ und „ausgefallen“ weichen ab (Schrift und Rahmen in der Tafel-Schrift). */
function badgeColorsOnScoreboard(state: MatchBadgeState): BadgeColors {
  if (state === 'ended' || state === 'cancelled') {
    const c = cssVars.colors;
    return { bg: c.statusFinishedBg, fg: c.scoreboardTextMuted, border: c.scoreboardTextMuted };
  }
  return badgeColors(state);
}

export function badgeColorsFor(state: MatchBadgeState, tone: MatchStatusBadgeTone | undefined, surface: MatchStatusBadgeSurface = 'app'): BadgeColors {
  if (tone === undefined) {
    if (surface === 'scoreboardFlach' && state === 'live') { return { bg: 'transparent', fg: cssVars.colors.scoreboardText }; }
    return surface === 'app' ? badgeColors(state) : badgeColorsOnScoreboard(state);
  }
  return state === 'live' ? { bg: tone.liveBg, fg: tone.liveFg } : { bg: tone.neutralBg, fg: tone.neutralFg };
}

const scoreArea = displayLayout.scoreArea;

export function badgeStyle(state: MatchBadgeState, size: MatchStatusBadgeSize, tone: MatchStatusBadgeTone | undefined, surface: MatchStatusBadgeSurface = 'app'): CSSProperties {
  const colors = badgeColorsFor(state, tone, surface);
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
    padding: `${cssVars.spacing.xs} ${size === 'row' || (surface === 'scoreboardFlach' && state === 'live') ? cssVars.spacing.xs : cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: size === 'tafel' ? cssVars.fontSizes.lg : cssVars.fontSizes.sm,
    lineHeight: size === 'tafel' ? cssVars.lineHeights.bodyMd : cssVars.lineHeights.bodySm,
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
