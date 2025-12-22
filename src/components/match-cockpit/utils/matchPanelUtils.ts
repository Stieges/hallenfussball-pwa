/**
 * Utility functions for match panel components
 */

import { theme } from '../../../styles/theme';
import { MatchStatus } from '../MatchCockpit';

/**
 * Formats seconds to MM:SS display format
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Returns German label for match status
 */
export function getStatusLabel(status: MatchStatus): string {
  switch (status) {
    case 'RUNNING':
      return 'läuft';
    case 'PAUSED':
      return 'pausiert';
    case 'FINISHED':
      return 'beendet';
    default:
      return 'bereit';
  }
}

/**
 * Returns theme color for match status
 */
export function getStatusColor(status: MatchStatus): string {
  switch (status) {
    case 'RUNNING':
      return theme.colors.primary;
    case 'PAUSED':
      return theme.colors.warning;
    case 'FINISHED':
      return theme.colors.text.secondary;
    default:
      return theme.colors.text.secondary;
  }
}
