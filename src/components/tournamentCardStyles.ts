/**
 * Feste Stile und Farben der Status-Marke der Turnierkarte (aus `TournamentCard.tsx` herausgelöst, unverändert; CA-5/Review CA-3–5:
 * Karte unter 300 Zeilen). Nur Werte ohne Abhängigkeit von Props und nur aus Tokens.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../design-tokens';
import type { Tournament } from '../types/tournament';

/**
 * Zustandsschild: Schrift immer `textPrimary` (Kontrast, Regel 5), der Zustand steht im Wort und am Rand in seiner Farbe
 * (@LZ-001, Farbe allein trägt nichts).
 */
export function statusBadgeColors(status: Tournament['status'], categoryLabel?: string): { background: string; color: string; borderColor: string } {
  const text = cssVars.colors.textPrimary;
  if (status === 'draft') {
    return { background: cssVars.colors.statusDraftBg, color: text, borderColor: cssVars.colors.statusDraft };
  }
  switch (categoryLabel) {
    case 'running':
      return { background: cssVars.colors.statusLiveBg, color: text, borderColor: cssVars.colors.statusLive };
    case 'upcoming':
      return { background: cssVars.colors.statusUpcomingBg, color: text, borderColor: cssVars.colors.statusUpcoming };
    case 'finished':
      return { background: cssVars.colors.statusFinishedBg, color: text, borderColor: cssVars.colors.statusFinished };
    default:
      return { background: cssVars.colors.surface, color: text, borderColor: cssVars.colors.border };
  }
}

export const statusBadgeStyle: CSSProperties = {
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  borderRadius: cssVars.borderRadius.sm,
  border: `${cssVars.borderWidth.thin} solid transparent`,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.semibold,
  whiteSpace: 'nowrap',
};

export const headerStyle: CSSProperties = {
  marginBottom: cssVars.spacing.md,
};

/** Schild und Menü stehen in einer eigenen Zeile über dem Titel (der Titel nutzt die volle Breite, kein Platzhalter nötig). */
export const badgeContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: cssVars.spacing.sm,
  marginBottom: cssVars.spacing.xs,
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
