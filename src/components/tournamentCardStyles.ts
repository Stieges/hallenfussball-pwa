/**
 * Feste Stile und Farben der Status-Marke der Turnierkarte (aus `TournamentCard.tsx` herausgelöst, unverändert; CA-5/Review CA-3–5:
 * Karte unter 300 Zeilen). Nur Werte ohne Abhängigkeit von Props und nur aus Tokens.
 */
import type { CSSProperties } from 'react';
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

export const headerStyle: CSSProperties = {
  marginTop: cssVars.spacing.xl, // Space below badge
  marginBottom: cssVars.spacing.md,
};

export const badgeContainerStyle: CSSProperties = {
  position: 'absolute',
  top: cssVars.spacing.md,
  right: cssVars.spacing.md,
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
};

export const infoGridStyle: CSSProperties = {
  display: 'grid',
  gap: cssVars.spacing.md,
};

export const infoItemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.xs,
};

export const valueStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textPrimary,
  fontWeight: cssVars.fontWeights.medium,
};
