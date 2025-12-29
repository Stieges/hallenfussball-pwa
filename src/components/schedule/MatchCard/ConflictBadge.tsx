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
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';
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
 * Get German label for conflict type
 */
function getConflictLabel(type: ConflictType): string {
  switch (type) {
    case 'team_double_booking':
      return 'Team-Doppelbelegung';
    case 'referee_double_booking':
      return 'SR-Doppelbelegung';
    case 'field_overlap':
      return 'Feld-Überlappung';
    case 'break_violation':
      return 'Pausenzeit unterschritten';
    case 'dependency_violation':
      return 'Abhängigkeitskonflikt';
    default:
      return 'Konflikt';
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
      fontSize: fontSizes.xs,
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
    backgroundColor: severity === 'error' ? colors.error : colors.warning,
    color: severity === 'error' ? colors.onError : colors.onWarning,
    borderRadius: borderRadius.full,
    fontWeight: fontWeights.bold,
    cursor: showTooltip ? 'help' : 'default',
    zIndex: 10,
    boxShadow: `0 2px 4px ${colors.shadowSoft}`,
    border: `2px solid ${colors.surface}`,
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
    marginBottom: spacing.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    backgroundColor: colors.surfaceSolid,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    boxShadow: `0 4px 12px ${colors.shadowMedium}`,
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
    gap: spacing.xs,
    marginBottom: spacing.xs,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: severity === 'error' ? colors.error : colors.warning,
  };

  const conflictListStyle: CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  };

  const conflictItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: `${spacing.xs} 0`,
    borderTop: `1px solid ${colors.borderSubtle}`,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  };

  const conflictIconStyle: CSSProperties = {
    flexShrink: 0,
    fontSize: fontSizes.md,
  };

  const conflictTextStyle: CSSProperties = {
    flex: 1,
  };

  const conflictTypeStyle: CSSProperties = {
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
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
        aria-label={`${conflicts.length} Konflikt${conflicts.length > 1 ? 'e' : ''}`}
      >
        {badgeContent}
      </div>

      {showTooltip && (
        <div style={tooltipStyle} role="tooltip">
          <div style={tooltipHeaderStyle}>
            <span>{severity === 'error' ? '⛔' : '⚠️'}</span>
            <span>
              {conflicts.length} Konflikt{conflicts.length > 1 ? 'e' : ''}
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
                    {getConflictLabel(conflict.type)}
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
