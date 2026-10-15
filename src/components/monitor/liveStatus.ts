import type { MonitorThemeColors } from '../../design-tokens';
import type { MatchStatus } from '../../hooks/useLiveMatches';

/**
 * Status-Marke der Live-Folie (LIVE, PAUSE, BEENDET, WARTET).
 * B-44a2: „BEENDET“ und „WARTET“ in der Textfarbe statt der blassen Zweitfarbe (Kontrast ≥ 4,5 : 1, Anzeigetafel).
 */
export function getStatusInfo(
  status: MatchStatus,
  themeColors: MonitorThemeColors
): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'RUNNING':
      return { label: 'LIVE', color: themeColors.liveBadgeText, bgColor: themeColors.liveBadgeBg };
    case 'PAUSED':
      return { label: 'PAUSE', color: themeColors.pauseBadgeText, bgColor: themeColors.pauseBadgeBg };
    case 'FINISHED':
      return { label: 'BEENDET', color: themeColors.text, bgColor: themeColors.border };
    case 'NOT_STARTED':
    default:
      return { label: 'WARTET', color: themeColors.text, bgColor: themeColors.border };
  }
}
