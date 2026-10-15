import type { MonitorThemeColors } from '../../design-tokens';
import type { MatchStatus } from '../../hooks/useLiveMatches';

export interface StatusInfo {
  label: string;
  /** Textfarbe der Marke: immer die Textfarbe des Themes (Kontrast ≥ 4,5 : 1 auf dem Marken-Hintergrund) */
  color: string;
  bgColor: string;
  /** Ton der Marke: Farbe des Punktes (LIVE grün, PAUSE gelb, sonst neutral) */
  dotColor: string;
}

/**
 * Status-Marke der Live-Folie (LIVE, PAUSE, BEENDET, WARTET).
 * B-44a2: eine Gestaltung für alle Zustände (gleiche Form und Größe), nur Text und Ton (Punkt, Hintergrund) wechseln.
 */
export function getStatusInfo(status: MatchStatus, themeColors: MonitorThemeColors): StatusInfo {
  switch (status) {
    case 'RUNNING':
      return { label: 'LIVE', color: themeColors.text, bgColor: themeColors.liveBadgeBg, dotColor: themeColors.liveBadgeText };
    case 'PAUSED':
      return { label: 'PAUSE', color: themeColors.text, bgColor: themeColors.pauseBadgeBg, dotColor: themeColors.pauseBadgeText };
    case 'FINISHED':
      return { label: 'BEENDET', color: themeColors.text, bgColor: themeColors.border, dotColor: themeColors.textSecondary };
    case 'NOT_STARTED':
    default:
      return { label: 'WARTET', color: themeColors.text, bgColor: themeColors.border, dotColor: themeColors.textSecondary };
  }
}
