/**
 * ExtendedActionsPanel - Additional controls for extended mode
 *
 * Provides quick access to:
 * - Score correction
 * - Time adjustment
 * - Yellow/Red cards
 * - Substitutions (future)
 */

import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens'
import type { Breakpoint } from '../../../../hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtendedActionsPanelProps {
  onEditScore?: () => void;
  onAdjustTime?: () => void;
  onYellowCard?: () => void;
  onRedCard?: () => void;
  onTimePenalty?: () => void;
  onSubstitution?: () => void;
  /** BUG-002: Event log button for mobile retroactive editing */
  onEventLog?: () => void;
  disabled?: boolean;
  breakpoint?: Breakpoint;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExtendedActionsPanel: React.FC<ExtendedActionsPanelProps> = ({
  onEditScore,
  onAdjustTime,
  onYellowCard,
  onRedCard,
  onTimePenalty,
  onSubstitution,
  onEventLog,
  disabled = false,
  breakpoint = 'desktop',
}) => {
  const { t } = useTranslation('cockpit');
  const isMobile = breakpoint === 'mobile';

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: cssVars.spacing.xs,
    justifyContent: 'center',
    padding: cssVars.spacing.xs,
    background: cssVars.colors.surfaceDark,
    borderRadius: cssVars.borderRadius.sm,
    border: `1px solid ${cssVars.colors.border}`,
  };

  const buttonStyle = (bgColor: string, textColor: string): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    padding: isMobile ? `${cssVars.spacing.xs} ${cssVars.spacing.sm}` : `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    minHeight: '44px',
    fontSize: isMobile ? cssVars.fontSizes.xs : cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: disabled ? cssVars.colors.textDisabled : textColor,
    background: disabled ? cssVars.colors.surfaceDark : bgColor,
    border: `1px solid ${disabled ? cssVars.colors.border : textColor}30`,
    borderRadius: cssVars.borderRadius.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Score Correction */}
      {onEditScore && (
        <button
          style={buttonStyle(cssVars.colors.surface, cssVars.colors.textPrimary)}
          onClick={onEditScore}
          disabled={disabled}
          type="button"
          aria-label={t('extended.editScoreAria')}
        >
          ✏️ {!isMobile && t('extended.score')}
        </button>
      )}

      {/* Time Adjustment */}
      {onAdjustTime && (
        <button
          style={buttonStyle(cssVars.colors.surface, cssVars.colors.textPrimary)}
          onClick={onAdjustTime}
          disabled={disabled}
          type="button"
          aria-label={t('extended.adjustTimeAria')}
        >
          ⏱️ {!isMobile && t('extended.time')}
        </button>
      )}

      {/* Yellow Card */}
      {onYellowCard && (
        <button
          style={buttonStyle(cssVars.colors.warningLight, cssVars.colors.warning)}
          onClick={onYellowCard}
          disabled={disabled}
          type="button"
          aria-label={t('extended.yellowCardAria')}
        >
          🟨 {!isMobile && t('extended.yellow')}
        </button>
      )}

      {/* Red Card */}
      {onRedCard && (
        <button
          style={buttonStyle(cssVars.colors.errorLight, cssVars.colors.error)}
          onClick={onRedCard}
          disabled={disabled}
          type="button"
          aria-label={t('extended.redCardAria')}
        >
          🟥 {!isMobile && t('extended.red')}
        </button>
      )}

      {/* Time Penalty */}
      {onTimePenalty && (
        <button
          style={buttonStyle(cssVars.colors.surface, cssVars.colors.warning)}
          onClick={onTimePenalty}
          disabled={disabled}
          type="button"
          aria-label={t('extended.timePenaltyAria')}
        >
          ⏱️ {!isMobile && t('extended.timePenalty')}
        </button>
      )}

      {/* Substitution */}
      {onSubstitution && (
        <button
          style={buttonStyle(cssVars.colors.surface, cssVars.colors.info)}
          onClick={onSubstitution}
          disabled={disabled}
          type="button"
          aria-label={t('extended.substitutionAria')}
        >
          🔄 {!isMobile && t('extended.substitution')}
        </button>
      )}

      {/* BUG-002: Event Log for retroactive editing on mobile */}
      {onEventLog && (
        <button
          style={buttonStyle(cssVars.colors.surface, cssVars.colors.textSecondary)}
          onClick={onEventLog}
          disabled={disabled}
          type="button"
          aria-label={t('extended.eventLogAria')}
        >
          📋 {!isMobile && t('extended.events')}
        </button>
      )}
    </div>
  );
};

export default ExtendedActionsPanel;
