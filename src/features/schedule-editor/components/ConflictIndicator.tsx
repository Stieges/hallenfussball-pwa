/**
 * US-SCHEDULE-EDITOR: ConflictIndicator Component
 *
 * Visual indicators for schedule conflicts.
 * Shows badges, tooltips, and detailed conflict information.
 */

import React, { useState } from 'react';
import { ScheduleConflict, ConflictType } from '../types';
import { getConflictTypeLabel } from '../utils/scheduleConflicts';
import { colors, spacing, borderRadius, fontSizes, fontWeights, shadows } from '../../../design-tokens';

// ============================================================================
// Types
// ============================================================================

interface ConflictIndicatorProps {
  /** Conflicts to display */
  conflicts: ScheduleConflict[];
  /** Display mode */
  variant?: 'badge' | 'inline' | 'detailed';
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Maximum conflicts to show before "+N more" */
  maxVisible?: number;
}

interface ConflictBadgeProps {
  conflict: ScheduleConflict;
  onClick?: () => void;
}

// ============================================================================
// Badge Component
// ============================================================================

export const ConflictBadge: React.FC<ConflictBadgeProps> = ({ conflict, onClick }) => {
  const isError = conflict.severity === 'error';

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    backgroundColor: isError ? 'rgba(239, 83, 80, 0.15)' : 'rgba(255, 193, 7, 0.15)',
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: isError ? colors.error : colors.warning,
    cursor: onClick ? 'pointer' : 'default',
  };

  const iconMap: Record<ConflictType, string> = {
    team_double_booking: '👥',
    referee_double_booking: '🏃',
    field_overlap: '⚽',
    break_violation: '⏱️',
    dependency_violation: '🔗',
  };

  return (
    <span style={badgeStyle} onClick={onClick} title={conflict.message}>
      <span>{iconMap[conflict.type] || '⚠️'}</span>
      <span>{getConflictTypeLabel(conflict.type)}</span>
    </span>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ConflictIndicator: React.FC<ConflictIndicatorProps> = ({
  conflicts,
  variant = 'badge',
  showTooltip = true,
  maxVisible = 3,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (conflicts.length === 0) {return null;}

  const errorCount = conflicts.filter(c => c.severity === 'error').length;
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;
  const visibleConflicts = conflicts.slice(0, maxVisible);
  const remainingCount = conflicts.length - maxVisible;

  // =========================================================================
  // Variant: Badge (compact)
  // =========================================================================

  if (variant === 'badge') {
    const containerStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: spacing.xs,
      position: 'relative',
    };

    const countBadgeStyle = (isError: boolean): React.CSSProperties => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '20px',
      height: '20px',
      padding: `0 ${spacing.xs}`,
      backgroundColor: isError ? colors.error : colors.warning,
      color: isError ? '#fff' : '#000',
      borderRadius: '10px',
      fontSize: fontSizes.xs,
      fontWeight: fontWeights.bold,
    });

    return (
      <div
        style={containerStyle}
        onMouseEnter={() => showTooltip && setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
      >
        {errorCount > 0 && (
          <span style={countBadgeStyle(true)} title={`${errorCount} Fehler`}>
            ⚠ {errorCount}
          </span>
        )}
        {warningCount > 0 && (
          <span style={countBadgeStyle(false)} title={`${warningCount} Warnungen`}>
            ⚡ {warningCount}
          </span>
        )}

        {/* Tooltip */}
        {showDetails && (
          <ConflictTooltip conflicts={conflicts} />
        )}
      </div>
    );
  }

  // =========================================================================
  // Variant: Inline (list of badges)
  // =========================================================================

  if (variant === 'inline') {
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: spacing.xs,
      alignItems: 'center',
    };

    const moreStyle: React.CSSProperties = {
      fontSize: fontSizes.xs,
      color: colors.textSecondary,
    };

    return (
      <div style={containerStyle}>
        {visibleConflicts.map(conflict => (
          <ConflictBadge key={conflict.id} conflict={conflict} />
        ))}
        {remainingCount > 0 && (
          <span style={moreStyle}>+{remainingCount} weitere</span>
        )}
      </div>
    );
  }

  // =========================================================================
  // Variant: Detailed (full list)
  // =========================================================================

  if (variant === 'detailed') {
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.sm,
    };

    const itemStyle = (isError: boolean): React.CSSProperties => ({
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.xs,
      padding: spacing.sm,
      backgroundColor: isError ? 'rgba(239, 83, 80, 0.1)' : 'rgba(255, 193, 7, 0.1)',
      borderLeft: `3px solid ${isError ? colors.error : colors.warning}`,
      borderRadius: `0 ${borderRadius.sm} ${borderRadius.sm} 0`,
    });

    const titleStyle: React.CSSProperties = {
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    };

    const messageStyle: React.CSSProperties = {
      fontSize: fontSizes.sm,
      color: colors.textSecondary,
    };

    const suggestionStyle: React.CSSProperties = {
      fontSize: fontSizes.xs,
      color: colors.primary,
      fontStyle: 'italic',
    };

    return (
      <div style={containerStyle}>
        {conflicts.map(conflict => (
          <div key={conflict.id} style={itemStyle(conflict.severity === 'error')}>
            <div style={titleStyle}>
              {conflict.severity === 'error' ? '⚠️' : '⚡'}{' '}
              {getConflictTypeLabel(conflict.type)}
            </div>
            <div style={messageStyle}>{conflict.message}</div>
            {conflict.suggestion && (
              <div style={suggestionStyle}>💡 {conflict.suggestion}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
};

// ============================================================================
// Tooltip Component
// ============================================================================

interface ConflictTooltipProps {
  conflicts: ScheduleConflict[];
}

const ConflictTooltip: React.FC<ConflictTooltipProps> = ({ conflicts }) => {
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    boxShadow: shadows.lg,
    zIndex: 1000,
    minWidth: '200px',
    maxWidth: '300px',
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  };

  const itemStyle: React.CSSProperties = {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.xs,
  };

  return (
    <div style={tooltipStyle}>
      <div style={listStyle}>
        {conflicts.map(conflict => (
          <div key={conflict.id} style={itemStyle}>
            <span>{conflict.severity === 'error' ? '⚠️' : '⚡'}</span>
            <span>{conflict.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConflictIndicator;
