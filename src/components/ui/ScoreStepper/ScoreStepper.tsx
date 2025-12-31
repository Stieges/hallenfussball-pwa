/**
 * ScoreStepper - Score input with team avatar
 *
 * Specialized stepper for match score input in the schedule view.
 * Displays team avatar, name, and +/- controls for score adjustment.
 *
 * Layout: [Avatar] Team Name [−] Value [+]
 *
 * @example
 * ```tsx
 * <ScoreStepper
 *   value={2}
 *   onChange={(v) => setHomeScore(v)}
 *   teamName="FC Bayern"
 *   avatarColor="#DC052D"
 * />
 * ```
 */

import { type CSSProperties, useCallback } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreStepperProps {
  /** Current score value */
  value: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Team name to display */
  teamName: string;
  /** Avatar background color (team color) */
  avatarColor?: string;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 99) */
  max?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only mode (displays value without controls) */
  readOnly?: boolean;
  /** Avatar size in pixels (default: 32) */
  avatarSize?: number;
  /** Show avatar (default: true) */
  showAvatar?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ScoreStepper: React.FC<ScoreStepperProps> = ({
  value,
  onChange,
  teamName,
  avatarColor = colors.primary,
  min = 0,
  max = 99,
  disabled = false,
  readOnly = false,
  avatarSize = 32,
  showAvatar = true,
}) => {
  const handleDecrement = useCallback(() => {
    if (!disabled && !readOnly && value > min) {
      onChange(value - 1);
    }
  }, [disabled, readOnly, value, min, onChange]);

  const handleIncrement = useCallback(() => {
    if (!disabled && !readOnly && value < max) {
      onChange(value + 1);
    }
  }, [disabled, readOnly, value, max, onChange]);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  };

  const teamInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0, // Allow text truncation
  };

  const avatarStyle: CSSProperties = {
    width: avatarSize,
    height: avatarSize,
    borderRadius: '6px',
    backgroundColor: avatarColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.round(avatarSize * 0.4),
    fontWeight: fontWeights.bold,
    color: colors.onPrimary,
    flexShrink: 0,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  };

  const controlsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  };

  const buttonStyle = (isDisabled: boolean): CSSProperties => ({
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: fontWeights.semibold,
    color: isDisabled ? colors.textDisabled : colors.textPrimary,
    backgroundColor: isDisabled ? colors.surfaceDark : colors.surfaceElevated,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'background-color 0.15s ease, transform 0.1s ease',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    // Mobile touch improvements - prevent 300ms delay and double-tap zoom
    touchAction: 'manipulation',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  });

  const valueStyle: CSSProperties = {
    minWidth: '40px',
    textAlign: 'center',
    fontSize: '28px',
    fontWeight: 900,
    color: colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Get team initials for avatar
  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return words
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div style={containerStyle}>
      {/* Team Info */}
      <div style={teamInfoStyle}>
        {showAvatar && (
          <div style={avatarStyle} aria-hidden="true">
            {getInitials(teamName)}
          </div>
        )}
        <span style={teamNameStyle}>{teamName}</span>
      </div>

      {/* Score Controls */}
      <div style={controlsStyle}>
        {!readOnly && (
          <button
            type="button"
            style={buttonStyle(disabled || value <= min)}
            onClick={handleDecrement}
            disabled={disabled || value <= min}
            aria-label={`${teamName} Tor entfernen`}
          >
            −
          </button>
        )}

        <span style={valueStyle} aria-live="polite">
          {value}
        </span>

        {!readOnly && (
          <button
            type="button"
            style={buttonStyle(disabled || value >= max)}
            onClick={handleIncrement}
            disabled={disabled || value >= max}
            aria-label={`${teamName} Tor hinzufügen`}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
};

export default ScoreStepper;
