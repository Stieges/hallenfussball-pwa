/**
 * ConflictBadge - Visual indicator for schedule conflicts
 *
 * Displays conflict information on match cards with:
 * - Color-coded severity (error = red, warning = orange)
 * - Icon based on conflict type
 * - Tooltip with conflict details
 *
 * Used in EditableMatchCard to show live conflict feedback.
 */

import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens'
import type { ScheduleConflict, ConflictType } from '../../../features/schedule-editor/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConflictBadgeProps {
  /** List of conflicts to display */
  conflicts: ScheduleConflict[];
  /** Size variant */
  size?: 'sm' | 'md';
  /** Whether to show tooltip on hover */
  showTooltip?: boolean;
  /** Position of the badge */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get icon for conflict type
 */
function getConflictIcon(type: ConflictType): string {
  switch (type) {
    case 'team_double_booking':
      return '👥'; // Two people = team conflict
    case 'referee_double_booking':
      return '🎯'; // Target = referee conflict
    case 'field_overlap':
      return '🏟️'; // Stadium = field conflict
    case 'break_violation':
      return '⏱️'; // Timer = break violation
    case 'dependency_violation':
      return '🔗'; // Link = dependency
    default:
      return '⚠️';
  }
}

/**
 * Get label for conflict type using i18n
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getConflictLabel(type: ConflictType, t: (key: any) => string): string {
  switch (type) {
    case 'team_double_booking':
      return t('conflict.teamDoubleBooking');
    case 'referee_double_booking':
      return t('conflict.refereeDoubleBooking');
    case 'field_overlap':
      return t('conflict.fieldOverlap');
    case 'break_violation':
      return t('conflict.breakViolation');
    case 'dependency_violation':
      return t('conflict.dependencyViolation');
    default:
      return t('conflict.generic');
  }
}

/**
 * Get most severe conflict from list
 */
function getMostSevere(conflicts: ScheduleConflict[]): 'error' | 'warning' {
  return conflicts.some(c => c.severity === 'error') ? 'error' : 'warning';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConflictBadge: React.FC<ConflictBadgeProps> = ({
  conflicts,
  size = 'md',
  showTooltip = true,
  position = 'top-right',
}) => {
  const { t } = useTranslation('tournament');
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  if (conflicts.length === 0) {
    return null;
  }

  const severity = getMostSevere(conflicts);
  const hasMultiple = conflicts.length > 1;

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const sizeStyles = {
    sm: {
      width: 20,
      height: 20,
      fontSize: '10px',
    },
    md: {
      width: 24,
      height: 24,
      fontSize: cssVars.fontSizes.xs,
    },
  };

  const positionStyles: Record<string, CSSProperties> = {
    'top-right': {
      position: 'absolute',
      top: -8,
      right: -8,
    },
    'top-left': {
      position: 'absolute',
      top: -8,
      left: -8,
    },
    'bottom-right': {
      position: 'absolute',
      bottom: -8,
      right: -8,
    },
    'bottom-left': {
      position: 'absolute',
      bottom: -8,
      left: -8,
    },
    inline: {
      position: 'relative',
    },
  };

  const badgeStyle: CSSProperties = {
    ...sizeStyles[size],
    ...positionStyles[position],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: severity === 'error' ? cssVars.colors.error : cssVars.colors.warning,
    color: severity === 'error' ? cssVars.colors.onError : cssVars.colors.onWarning,
    borderRadius: cssVars.borderRadius.full,
    fontWeight: cssVars.fontWeights.bold,
    cursor: showTooltip ? 'help' : 'default',
    zIndex: 10,
    boxShadow: `0 2px 4px ${cssVars.colors.shadowSoft}`,
    border: `2px solid ${cssVars.colors.surface}`,
  };

  const tooltipContainerStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
  };

  const tooltipStyle: CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    backgroundColor: cssVars.colors.surfaceSolid,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    boxShadow: `0 4px 12px ${cssVars.colors.shadowMedium}`,
    minWidth: '200px',
    maxWidth: '300px',
    zIndex: 100,
    opacity: isTooltipVisible ? 1 : 0,
    visibility: isTooltipVisible ? 'visible' : 'hidden',
    transition: 'opacity 0.15s ease, visibility 0.15s ease',
    pointerEvents: isTooltipVisible ? 'auto' : 'none',
  };

  const tooltipHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    marginBottom: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.bold,
    color: severity === 'error' ? cssVars.colors.error : cssVars.colors.warning,
  };

  const conflictListStyle: CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  };

  const conflictItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} 0`,
    borderTop: `1px solid ${cssVars.colors.borderSubtle}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const conflictIconStyle: CSSProperties = {
    flexShrink: 0,
    fontSize: cssVars.fontSizes.md,
  };

  const conflictTextStyle: CSSProperties = {
    flex: 1,
  };

  const conflictTypeStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
    display: 'block',
    marginBottom: '2px',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const badgeContent = hasMultiple ? conflicts.length.toString() : '!';

  return (
    <div
      style={tooltipContainerStyle}
      onMouseEnter={() => showTooltip && setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <div
        style={badgeStyle}
        role="img"
        aria-label={t('conflict.count', { count: conflicts.length })}
      >
        {badgeContent}
      </div>

      {showTooltip && (
        <div style={tooltipStyle} role="tooltip">
          <div style={tooltipHeaderStyle}>
            <span>{severity === 'error' ? '⛔' : '⚠️'}</span>
            <span>
              {t('conflict.count', { count: conflicts.length })}
            </span>
          </div>

          <ul style={conflictListStyle}>
            {conflicts.map((conflict) => (
              <li key={conflict.id} style={conflictItemStyle}>
                <span style={conflictIconStyle}>
                  {getConflictIcon(conflict.type)}
                </span>
                <div style={conflictTextStyle}>
                  <span style={conflictTypeStyle}>
                    {getConflictLabel(conflict.type, t)}
                  </span>
                  {conflict.message}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ConflictBadge;
