/**
 * TournamentCard - Turnier-Karte für "Meine Turniere"
 *
 * Zeigt Turnier-Info mit Rolle und Status.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.3
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
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
    color: cssVars.colors.statusLive,
    bgColor: cssVars.colors.statusLiveBg,
  },
  upcoming: {
    label: 'Geplant',
    icon: '📅',
    color: cssVars.colors.statusUpcoming,
    bgColor: cssVars.colors.statusUpcomingBg,
  },
  finished: {
    label: 'Abgeschlossen',
    icon: '✅',
    color: cssVars.colors.statusFinished,
    bgColor: cssVars.colors.statusFinishedBg,
  },
  draft: {
    label: 'Entwurf',
    icon: '📝',
    color: cssVars.colors.statusDraft,
    bgColor: cssVars.colors.statusDraftBg,
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
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    boxShadow: cssVars.shadows.sm,
    minHeight: '80px',
    // Reset button styles
    font: 'inherit',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: cssVars.spacing.sm,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  icon: {
    fontSize: cssVars.fontSizes.lg,
  },
  title: {
    margin: 0,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  },
  arrow: {
    fontSize: cssVars.fontSizes.lg,
    color: cssVars.colors.textTertiary,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    flexWrap: 'wrap',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    padding: `2px ${cssVars.spacing.xs}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
  },
  statusIcon: {
    fontSize: cssVars.fontSizes.xs,
  },
  separator: {
    color: cssVars.colors.textTertiary,
    fontSize: cssVars.fontSizes.sm,
  },
  meta: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  description: {
    margin: 0,
    marginTop: '2px',
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textTertiary,
  },
};

export default TournamentCard;
