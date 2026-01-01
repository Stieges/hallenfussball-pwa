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
          aria-label="Ergebnis korrigieren"
        >
          ✏️ {!isMobile && 'Ergebnis'}
        </button>
      )}

      {/* Time Adjustment */}
      {onAdjustTime && (
        <button
          style={buttonStyle(cssVars.colors.surface, cssVars.colors.textPrimary)}
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
          style={buttonStyle(cssVars.colors.warningLight, cssVars.colors.warning)}
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
          style={buttonStyle(cssVars.colors.errorLight, cssVars.colors.error)}
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
          style={buttonStyle(cssVars.colors.surface, cssVars.colors.warning)}
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
          style={buttonStyle(cssVars.colors.surface, cssVars.colors.info)}
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
