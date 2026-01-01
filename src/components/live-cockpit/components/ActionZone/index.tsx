/**
 * ActionZone - Goal Buttons and Score Correction
 *
 * Located in the "thumb zone" (bottom of screen) for easy reach.
 * Contains:
 * - Large goal increment buttons (+)
 * - Smaller goal decrement buttons (-) for corrections
 *
 * Touch targets: 48x48px minimum with 8dp spacing (WCAG, Material Design)
 */

import { useState, useCallback, type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens'
import { useLongPress, type Breakpoint } from '../../../../hooks';
import { triggerHaptic } from '../../../../utils/haptics';
import type { TeamSide } from '../../types';
import styles from '../../LiveCockpit.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionZoneProps {
  onGoal: (side: TeamSide, direction: 'INC' | 'DEC') => void;
  canDecrementHome: boolean;
  canDecrementAway: boolean;
  homeTeamName: string;
  awayTeamName: string;
  disabled?: boolean;
  showMinusButtons?: boolean;
  /** @deprecated Use breakpoint instead */
  isMobile?: boolean;
  breakpoint?: Breakpoint;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ActionZone: React.FC<ActionZoneProps> = ({
  onGoal,
  canDecrementHome,
  canDecrementAway,
  homeTeamName,
  awayTeamName,
  disabled = false,
  showMinusButtons = true,
  isMobile: isMobileProp,
  breakpoint = 'desktop',
}) => {
  // Backwards compatibility: use isMobile prop if breakpoint not provided
  const isMobile = isMobileProp ?? breakpoint === 'mobile';

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
    width: '100%',
  };

  const teamSectionStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    gap: cssVars.spacing.xs,
    alignItems: 'stretch',
  };

  return (
    <div style={containerStyle} className={styles.actionZone}>
      {/* Home Team Actions */}
      <div style={teamSectionStyle}>
        {showMinusButtons && (
          <MinusButton
            onClick={() => onGoal('home', 'DEC')}
            disabled={disabled || !canDecrementHome}
            breakpoint={breakpoint}
            ariaLabel={`Tor für ${homeTeamName} entfernen`}
          />
        )}
        <GoalButton
          onClick={() => onGoal('home', 'INC')}
          onLongPress={() => onGoal('home', 'DEC')}
          canLongPress={canDecrementHome}
          disabled={disabled}
          breakpoint={breakpoint}
          side="home"
          teamName={homeTeamName}
          ariaLabel={`Tor für ${homeTeamName} hinzufügen`}
        />
      </div>

      {/* Away Team Actions */}
      <div style={teamSectionStyle}>
        <GoalButton
          onClick={() => onGoal('away', 'INC')}
          onLongPress={() => onGoal('away', 'DEC')}
          canLongPress={canDecrementAway}
          disabled={disabled}
          breakpoint={breakpoint}
          side="away"
          teamName={awayTeamName}
          ariaLabel={`Tor für ${awayTeamName} hinzufügen`}
        />
        {showMinusButtons && (
          <MinusButton
            onClick={() => onGoal('away', 'DEC')}
            disabled={disabled || !canDecrementAway}
            breakpoint={breakpoint}
            ariaLabel={`Tor für ${awayTeamName} entfernen`}
          />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

interface GoalButtonProps {
  onClick: () => void;
  /** Optional callback for long press (e.g., decrement goal) */
  onLongPress?: () => void;
  disabled?: boolean;
  breakpoint: Breakpoint;
  side: TeamSide;
  teamName: string;
  ariaLabel: string;
  /** Whether long press is enabled (e.g., requires score > 0) */
  canLongPress?: boolean;
}

const GoalButton: React.FC<GoalButtonProps> = ({
  onClick,
  onLongPress,
  disabled = false,
  breakpoint,
  side: _side,
  teamName,
  ariaLabel,
  canLongPress = false,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';

  // Handle short press (tap) with animation
  const handleShortPress = useCallback(() => {
    if (disabled) {
      return;
    }

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 400);

    // Haptic feedback for goal
    triggerHaptic('medium');

    onClick();
  }, [disabled, onClick]);

  // Handle long press for decrement
  const handleLongPress = useCallback(() => {
    if (disabled || !canLongPress || !onLongPress) {
      return;
    }

    // Different animation for decrement
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 200);

    // Light haptic for correction
    triggerHaptic('light');

    onLongPress();
  }, [disabled, canLongPress, onLongPress]);

  // Long press hook
  const { handlers: longPressHandlers } = useLongPress({
    delay: 600, // 600ms for long press
    onShortPress: handleShortPress,
    onLongPress: canLongPress && onLongPress ? handleLongPress : undefined,
  });

  // Responsive sizing - KOMPAKT
  const getMinHeight = () => {
    if (isMobile) {
      return '56px';
    }
    if (isTablet) {
      return '60px';
    }
    return '56px';
  };

  const buttonStyle: CSSProperties = {
    flex: 1,
    minHeight: getMinHeight(),
    minWidth: '48px',
    display: 'flex',
    flexDirection: 'row', // Horizontal: Icon + Text
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    color: disabled ? cssVars.colors.textDisabled : cssVars.colors.onPrimary,
    background: disabled
      ? cssVars.colors.surfaceDark
      : `linear-gradient(135deg, ${cssVars.colors.primary}, ${cssVars.colors.primaryHover})`,
    border: disabled ? `1px solid ${cssVars.colors.border}` : 'none',
    borderRadius: cssVars.borderRadius.md,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : `0 2px 8px ${cssVars.colors.primary}40`,
    padding: isMobile ? `${cssVars.spacing.xs} ${cssVars.spacing.sm}` : cssVars.spacing.sm,
  };

  const iconStyle: CSSProperties = {
    fontSize: isMobile ? '18px' : '22px',
    lineHeight: 1,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.xs : cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    maxWidth: isMobile ? '70px' : '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const goalLabelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.normal,
    opacity: 0.8,
    display: isMobile ? 'none' : 'inline', // Versteckt auf Mobile
  };

  // Build aria label with long press hint
  const fullAriaLabel = canLongPress && onLongPress
    ? `${ariaLabel}. Lange drücken zum Entfernen.`
    : ariaLabel;

  return (
    <button
      style={buttonStyle}
      className={`${styles.goalButton} ${isAnimating ? styles.scored : ''}`}
      disabled={disabled}
      aria-label={fullAriaLabel}
      type="button"
      {...longPressHandlers}
    >
      <span style={iconStyle}>⚽</span>
      <span style={teamNameStyle}>{teamName}</span>
      {!isMobile && <span style={goalLabelStyle}>+1</span>}
    </button>
  );
};

interface MinusButtonProps {
  onClick: () => void;
  disabled?: boolean;
  breakpoint: Breakpoint;
  ariaLabel: string;
}

const MinusButton: React.FC<MinusButtonProps> = ({
  onClick,
  disabled = false,
  breakpoint,
  ariaLabel,
}) => {
  const isMobile = breakpoint === 'mobile';

  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }

    // Light haptic feedback for correction
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }

    onClick();
  }, [disabled, onClick]);

  const buttonStyle: CSSProperties = {
    width: '44px', // WCAG: 44px minimum touch target
    minHeight: isMobile ? '56px' : '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: isMobile ? '18px' : '20px',
    fontWeight: cssVars.fontWeights.semibold,
    color: disabled ? cssVars.colors.textDisabled : cssVars.colors.error,
    background: disabled ? cssVars.colors.surfaceDark : cssVars.colors.errorLight,
    border: `1px solid ${disabled ? cssVars.colors.border : cssVars.colors.error}40`,
    borderRadius: cssVars.borderRadius.md,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <button
      style={buttonStyle}
      className={styles.minusButton}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      type="button"
    >
      −
    </button>
  );
};

export default ActionZone;
