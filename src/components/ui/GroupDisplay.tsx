import React, { CSSProperties } from 'react';
import { TournamentGroup, Tournament } from '../../types/tournament';
import { getGroupDisplayName, getGroupShortCode } from '../../utils/displayNames';
import { borderRadius, colors, fontSizes, spacing } from '../../design-tokens';
export type GroupDisplayVariant = 'full' | 'badge' | 'short';

interface GroupDisplayProps {
  /** Gruppe als TournamentGroup-Objekt oder als Gruppen-ID (z.B. 'A') */
  group: TournamentGroup | string;
  /** Tournament für Lookup wenn nur group-ID übergeben wird */
  tournament?: Tournament;
  /** Anzeigevariante: full = "Gruppe Löwen", badge = farbiges Badge, short = nur Kürzel */
  variant?: GroupDisplayVariant;
  /** Custom Styles */
  style?: CSSProperties;
  /** CSS Klasse */
  className?: string;
}

/**
 * US-GROUPS-AND-FIELDS: Gekapselte Komponente für Gruppenanzeige
 *
 * Zeigt Gruppennamen konsistent überall in der App:
 * - Wizard
 * - Spielplan
 * - Live-Ticker
 * - PDF-Export
 *
 * Akzeptiert sowohl TournamentGroup-Objekte als auch einfache Gruppen-IDs
 * für einfache Migration bestehender Stellen.
 */
export const GroupDisplay: React.FC<GroupDisplayProps> = ({
  group,
  tournament,
  variant = 'full',
  style,
  className,
}) => {
  const displayName = getGroupDisplayName(group, tournament);
  const shortCode = getGroupShortCode(group, tournament);

  switch (variant) {
    case 'short':
      return (
        <span style={style} className={className}>
          {shortCode}
        </span>
      );

    case 'badge':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.primary + '20',
            color: colors.primary,
            fontSize: fontSizes.sm,
            fontWeight: 600,
            minWidth: '2rem',
            ...style,
          }}
          className={className}
        >
          {shortCode}
        </span>
      );

    default: // 'full'
      return (
        <span style={style} className={className}>
          {displayName}
        </span>
      );
  }
};

export default GroupDisplay;
