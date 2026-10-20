/**
 * Farben der Status-Marke auf der Turnierkarte (aus `TournamentCard.tsx` herausgelöst, CA-5: Karte unter 300 Zeilen halten).
 */
import { cssVars } from '../design-tokens';
import type { Tournament } from '../types/tournament';

export function statusBadgeColors(status: Tournament['status'], categoryLabel?: string): { background: string; color: string } {
  if (status === 'draft') {
    return { background: cssVars.colors.statusDraftBg, color: cssVars.colors.statusDraft };
  }
  switch (categoryLabel) {
    case 'running':
      return { background: cssVars.colors.statusLiveBg, color: cssVars.colors.statusLive };
    case 'upcoming':
      return { background: cssVars.colors.statusUpcomingBg, color: cssVars.colors.statusUpcoming };
    case 'finished':
      return { background: cssVars.colors.statusFinishedBg, color: cssVars.colors.statusFinished };
    default:
      return { background: cssVars.colors.surface, color: cssVars.colors.textSecondary };
  }
}
