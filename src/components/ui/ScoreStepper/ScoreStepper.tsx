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
import { cssVars } from '../../../design-tokens';
import { TeamAvatar } from '../TeamAvatar';
import type { TeamLogo, TeamColors } from '../../../types/tournament';

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
  /** Team logo (optional) */
  teamLogo?: TeamLogo;
  /** Team colors (optional) */
  teamColors?: TeamColors;
  /** Avatar background color (team color) - deprecated, use teamColors instead */
  avatarColor?: string;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 99) */
  max?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only mode (displays value without controls) */
  readOnly?: boolean;
  /** Avatar size: 'sm' (32px), 'md' (40px), 'lg' (56px) - default: 'sm' */
  avatarSize?: 'sm' | 'md' | 'lg';
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
  teamLogo,
  teamColors,
  avatarColor,
  min = 0,
  max = 99,
  disabled = false,
  readOnly = false,
  avatarSize = 'sm',
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
    gap: cssVars.spacing.sm,
    width: '100%',
  };

  const teamInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    flex: 1,
    minWidth: 0, // Allow text truncation
  };

  // Build team object for TeamAvatar, using legacy avatarColor as fallback
  const teamData = {
    name: teamName,
    logo: teamLogo,
    colors: teamColors ?? (avatarColor ? { primary: avatarColor } : undefined),
  };

  const teamNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  };

  const controlsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
  };

  const buttonStyle = (isDisabled: boolean): CSSProperties => ({
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: cssVars.fontWeights.semibold,
    color: isDisabled ? cssVars.colors.textDisabled : cssVars.colors.textPrimary,
    backgroundColor: isDisabled ? cssVars.colors.surfaceDark : cssVars.colors.surfaceElevated,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
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
    color: cssVars.colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Team Info */}
      <div style={teamInfoStyle}>
        {showAvatar && (
          <TeamAvatar team={teamData} size={avatarSize} />
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
