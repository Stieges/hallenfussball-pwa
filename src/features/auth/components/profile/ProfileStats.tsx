/**
 * ProfileStats - User statistics display
 *
 * Shows tournament counts and activity metrics.
 *
 * @see UserProfileScreen.tsx
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

interface ProfileStatsProps {
  /** Total tournament count */
  totalTournaments: number;
  /** Live tournaments count */
  liveTournaments: number;
  /** Created (owned) tournaments count */
  createdTournaments: number;
}

/**
 * Individual stat item
 */
const StatItem: React.FC<{
  label: string;
  value: number | string;
  color?: string;
}> = ({ label, value, color }) => (
  <div style={styles.statItem}>
    <div style={{ ...styles.statValue, color: color || cssVars.colors.textPrimary }}>
      {value}
    </div>
    <div style={styles.statLabel}>{label}</div>
  </div>
);

export const ProfileStats: React.FC<ProfileStatsProps> = ({
  totalTournaments,
  liveTournaments,
  createdTournaments,
}) => {
  return (
    <div style={styles.statsGrid}>
      <StatItem label="Turniere" value={totalTournaments} />
      <StatItem
        label="Live"
        value={liveTournaments}
        color={cssVars.colors.statusLive}
      />
      <StatItem label="Erstellt" value={createdTournaments} />
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: cssVars.spacing.md,
  },
  statItem: {
    textAlign: 'center',
    padding: cssVars.spacing.sm,
    background: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.md,
  },
  statValue: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
  },
};

export default ProfileStats;
