/**
 * US-SCHEDULE-EDITOR: SkippedMatchOverlay Component
 *
 * Visual overlay for skipped matches showing:
 * - Skipped status indicator
 * - Reason for skipping
 * - Option to restore the match
 */

import React from 'react';
import { Match } from '../../../types/tournament';
import { colors, spacing, borderRadius, fontSizes, fontWeights } from '../../../design-tokens';
import { Button } from '../../../components/ui';

interface SkippedMatchOverlayProps {
  /** The skipped match */
  match: Match;
  /** Callback to restore the match */
  onUnskip: () => void;
  /** Whether the restore button should be shown */
  showRestoreButton?: boolean;
  /** Whether the component is in compact mode */
  compact?: boolean;
}

export const SkippedMatchOverlay: React.FC<SkippedMatchOverlayProps> = ({
  match,
  onUnskip,
  showRestoreButton = true,
  compact = false,
}) => {
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: compact ? spacing.xs : spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: borderRadius.md,
    padding: compact ? spacing.sm : spacing.md,
    zIndex: 10,
  };

  const iconStyle: React.CSSProperties = {
    fontSize: compact ? '20px' : '28px',
    color: colors.warning,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: compact ? fontSizes.sm : fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const reasonStyle: React.CSSProperties = {
    fontSize: compact ? fontSizes.xs : fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: '200px',
  };

  const timestampStyle: React.CSSProperties = {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  };

  // Format timestamp if available
  const formattedTime = match.skippedAt
    ? new Date(match.skippedAt).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div style={containerStyle}>
      {/* Icon */}
      <span style={iconStyle} role="img" aria-label="Übersprungen">
        ⊘
      </span>

      {/* Label */}
      <span style={labelStyle}>Übersprungen</span>

      {/* Reason */}
      {match.skippedReason && (
        <span style={reasonStyle}>{match.skippedReason}</span>
      )}

      {/* Timestamp */}
      {formattedTime && !compact && (
        <span style={timestampStyle}>{formattedTime}</span>
      )}

      {/* Restore Button */}
      {showRestoreButton && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: compact ? spacing.xs : spacing.sm }}
        >
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'md'}
            onClick={onUnskip}
            style={{
              color: colors.textPrimary,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            Wiederherstellen
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Compact inline indicator for skipped matches (for list views)
 */
interface SkippedBadgeProps {
  reason?: string;
}

export const SkippedBadge: React.FC<SkippedBadgeProps> = ({ reason }) => {
  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.warning,
  };

  return (
    <span style={badgeStyle} title={reason || 'Spiel übersprungen'}>
      <span>⊘</span>
      <span>Übersprungen</span>
    </span>
  );
};

export default SkippedMatchOverlay;
