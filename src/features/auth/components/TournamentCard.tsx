/**
 * TournamentCard - Turnier-Karte für "Meine Turniere"
 *
 * Zeigt Turnier-Info mit Rolle und Status.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.3
 */

import React, { CSSProperties } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
  shadows,
} from '../../../design-tokens';
import type { TournamentRole, TournamentMembership } from '../types/auth.types';
import { RoleBadge } from './RoleBadge';

/**
 * Turnier-Status für die Anzeige
 */
export type TournamentDisplayStatus = 'live' | 'upcoming' | 'finished' | 'draft';

/**
 * Vereinfachte Turnier-Daten für die Karte
 */
export interface TournamentCardData {
  id: string;
  title: string;
  status: TournamentDisplayStatus;
  teamCount: number;
  fieldCount: number;
  date?: string;
  location?: string;
}

interface TournamentCardProps {
  /** Turnier-Daten */
  tournament: TournamentCardData;
  /** User's Membership in diesem Turnier */
  membership: TournamentMembership;
  /** Team-Namen für Trainer (optional) */
  teamNames?: string[];
  /** Click-Handler */
  onClick?: () => void;
  /** Zusätzliche Styles */
  style?: CSSProperties;
}

/**
 * Status-Konfiguration für Anzeige
 */
const statusConfig: Record<
  TournamentDisplayStatus,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  live: {
    label: 'Live',
    icon: '🔴',
    color: colors.statusLive,
    bgColor: colors.statusLiveBg,
  },
  upcoming: {
    label: 'Geplant',
    icon: '📅',
    color: colors.statusUpcoming,
    bgColor: colors.statusUpcomingBg,
  },
  finished: {
    label: 'Abgeschlossen',
    icon: '✅',
    color: colors.statusFinished,
    bgColor: colors.statusFinishedBg,
  },
  draft: {
    label: 'Entwurf',
    icon: '📝',
    color: colors.statusDraft,
    bgColor: colors.statusDraftBg,
  },
};

/**
 * Beschreibungstext basierend auf Rolle
 */
const getRoleDescription = (role: TournamentRole, teamNames?: string[]): string => {
  switch (role) {
    case 'owner':
      return 'Du bist Ersteller dieses Turniers';
    case 'co-admin':
      return 'Du bist Stellvertreter';
    case 'trainer':
      return teamNames?.length ? teamNames.join(', ') : 'Deine Teams';
    case 'collaborator':
      return 'Du kannst Ergebnisse eingeben';
    case 'viewer':
      return 'Nur Ansicht';
  }
};

/**
 * TournamentCard - Zeigt ein Turnier mit Rolle und Status
 *
 * @example
 * ```tsx
 * <TournamentCard
 *   tournament={{ id: '1', title: 'Wintercup', status: 'live', teamCount: 8, fieldCount: 2 }}
 *   membership={{ role: 'owner', ... }}
 *   onClick={() => navigateTo(tournament.id)}
 * />
 * ```
 */
export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  membership,
  teamNames,
  onClick,
  style,
}) => {
  const status = statusConfig[tournament.status];
  const roleDescription = getRoleDescription(membership.role, teamNames);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...styles.card, ...style }}
      data-testid={`tournament-card-${tournament.id}`}
    >
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.icon}>🏆</span>
          <h3 style={styles.title}>{tournament.title}</h3>
        </div>
        <span style={styles.arrow}>→</span>
      </div>

      <div style={styles.content}>
        <div style={styles.badgeRow}>
          <RoleBadge role={membership.role} size="sm" />
        </div>

        <div style={styles.infoRow}>
          <span
            style={{
              ...styles.statusBadge,
              color: status.color,
              backgroundColor: status.bgColor,
            }}
          >
            <span style={styles.statusIcon}>{status.icon}</span>
            {status.label}
          </span>
          <span style={styles.separator}>·</span>
          <span style={styles.meta}>{tournament.teamCount} Teams</span>
          <span style={styles.separator}>·</span>
          <span style={styles.meta}>
            {tournament.fieldCount} {tournament.fieldCount === 1 ? 'Feld' : 'Felder'}
          </span>
        </div>

        <p style={styles.description}>{roleDescription}</p>
      </div>
    </button>
  );
};

const styles: Record<string, CSSProperties> = {
  card: {
    display: 'block',
    width: '100%',
    padding: spacing.md,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    boxShadow: shadows.sm,
    minHeight: '80px',
    // Reset button styles
    font: 'inherit',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    fontSize: fontSizes.lg,
  },
  title: {
    margin: 0,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  arrow: {
    fontSize: fontSizes.lg,
    color: colors.textTertiary,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    padding: `2px ${spacing.xs}`,
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
  },
  statusIcon: {
    fontSize: fontSizes.xs,
  },
  separator: {
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
  },
  meta: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  description: {
    margin: 0,
    marginTop: '2px',
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
  },
};

export default TournamentCard;
