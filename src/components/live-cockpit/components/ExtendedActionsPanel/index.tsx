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
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../../design-tokens';
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
  disabled = false,
  breakpoint = 'desktop',
}) => {
  const isMobile = breakpoint === 'mobile';

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    padding: spacing.xs,
    background: colors.surfaceDark,
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.border}`,
  };

  const buttonStyle = (bgColor: string, textColor: string): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: isMobile ? `${spacing.xs} ${spacing.sm}` : `${spacing.xs} ${spacing.md}`,
    minHeight: '44px',
    fontSize: isMobile ? fontSizes.xs : fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: disabled ? colors.textDisabled : textColor,
    background: disabled ? colors.surfaceDark : bgColor,
    border: `1px solid ${disabled ? colors.border : textColor}30`,
    borderRadius: borderRadius.sm,
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
          style={buttonStyle(colors.surface, colors.textPrimary)}
          onClick={onEditScore}
          disabled={disabled}
          type="button"
          aria-label="Ergebnis korrigieren"
        >
          ✏️ {!isMobile && 'Ergebnis'}
        </button>
      )}

      {/* Time Adjustment */}
      {onAdjustTime && (
        <button
          style={buttonStyle(colors.surface, colors.textPrimary)}
          onClick={onAdjustTime}
          disabled={disabled}
          type="button"
          aria-label="Zeit anpassen"
        >
          ⏱️ {!isMobile && 'Zeit'}
        </button>
      )}

      {/* Yellow Card */}
      {onYellowCard && (
        <button
          style={buttonStyle(colors.warningLight, colors.warning)}
          onClick={onYellowCard}
          disabled={disabled}
          type="button"
          aria-label="Gelbe Karte"
        >
          🟨 {!isMobile && 'Gelb'}
        </button>
      )}

      {/* Red Card */}
      {onRedCard && (
        <button
          style={buttonStyle(colors.errorLight, colors.error)}
          onClick={onRedCard}
          disabled={disabled}
          type="button"
          aria-label="Rote Karte"
        >
          🟥 {!isMobile && 'Rot'}
        </button>
      )}

      {/* Time Penalty */}
      {onTimePenalty && (
        <button
          style={buttonStyle(colors.surface, colors.warning)}
          onClick={onTimePenalty}
          disabled={disabled}
          type="button"
          aria-label="Zeitstrafe"
        >
          ⏱️ {!isMobile && 'Zeitstrafe'}
        </button>
      )}

      {/* Substitution */}
      {onSubstitution && (
        <button
          style={buttonStyle(colors.surface, colors.info)}
          onClick={onSubstitution}
          disabled={disabled}
          type="button"
          aria-label="Wechsel"
        >
          🔄 {!isMobile && 'Wechsel'}
        </button>
      )}
    </div>
  );
};

export default ExtendedActionsPanel;
