/**
 * TeamBlock - Score + Actions for one team
 *
 * Based on mockup: scoreboard-desktop.html
 * Contains: Team name, HEIM/GAST label, score, all action buttons
 */

import { type CSSProperties } from 'react';
import { colors, spacing, fontWeights, borderRadius } from '../../../../design-tokens';
import type { Breakpoint } from '../../../../hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamBlockProps {
  teamName: string;
  teamLabel: 'Heim' | 'Gast';
  score: number;
  fouls: number;
  disabled?: boolean;
  breakpoint?: Breakpoint;
  // Actions
  onGoal: () => void;
  onMinus: () => void;
  onPenalty: () => void;
  onYellowCard: () => void;
  onRedCard: () => void;
  onSubstitution: () => void;
  onFoul: () => void;
  canDecrement?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TeamBlock: React.FC<TeamBlockProps> = ({
  teamName,
  teamLabel,
  score,
  fouls: _fouls,
  disabled = false,
  breakpoint = 'desktop',
  onGoal,
  onMinus,
  onPenalty,
  onYellowCard,
  onRedCard,
  onSubstitution,
  onFoul,
  canDecrement = true,
}) => {
  const isMobile = breakpoint === 'mobile';

  // ---------------------------------------------------------------------------
  // Styles - Based on mockup
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    background: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: isMobile ? spacing.sm : spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? spacing.xs : spacing.sm,
  };

  const headerStyle: CSSProperties = {
    textAlign: 'center',
    marginBottom: isMobile ? spacing.xs : spacing.sm,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: isMobile ? '14px' : '22px',
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  };

  const teamLabelStyle: CSSProperties = {
    fontSize: isMobile ? '10px' : '11px',
    color: colors.textMuted,
    textTransform: 'uppercase',
  };

  const scoreStyle: CSSProperties = {
    fontSize: isMobile ? '64px' : '80px',
    fontWeight: fontWeights.bold,
    textAlign: 'center',
    lineHeight: 1,
    color: colors.textPrimary,
    margin: `${spacing.sm} 0`,
  };

  // Button base style
  const btnStyle: CSSProperties = {
    fontFamily: 'inherit',
    border: `1px solid ${colors.borderSolid}`,
    borderRadius: borderRadius.md,
    padding: isMobile ? `${spacing.sm} ${spacing.xs}` : spacing.md,
    fontSize: isMobile ? '12px' : '13px',
    fontWeight: fontWeights.semibold,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    background: colors.background,
    color: disabled ? colors.textDisabled : colors.textPrimary,
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s',
  };

  const btnGoalStyle: CSSProperties = {
    ...btnStyle,
    background: colors.primary,
    color: colors.onPrimary,
    border: 'none',
    padding: isMobile ? `${spacing.md} ${spacing.sm}` : spacing.lg,
    fontSize: isMobile ? '14px' : '15px',
    fontWeight: fontWeights.bold,
    flex: 1,
  };

  const btnMinusStyle: CSSProperties = {
    ...btnStyle,
    background: colors.background,
    color: disabled || !canDecrement ? colors.textDisabled : colors.error,
    borderColor: disabled || !canDecrement ? colors.borderSolid : colors.error,
    minWidth: '44px', // WCAG: 44px minimum touch target
    opacity: disabled || !canDecrement ? 0.5 : 1,
    cursor: disabled || !canDecrement ? 'not-allowed' : 'pointer',
  };

  const btnPenaltyStyle: CSSProperties = {
    ...btnStyle,
    background: colors.background,
    borderColor: colors.warning,
    color: colors.warning,
    padding: isMobile ? `${spacing.sm} ${spacing.md}` : `${spacing.md} ${spacing.lg}`,
    fontSize: isMobile ? '12px' : '14px',
  };

  const btnYellowStyle: CSSProperties = {
    ...btnStyle,
    color: disabled ? colors.textDisabled : colors.warning,
  };

  const btnRedStyle: CSSProperties = {
    ...btnStyle,
    color: disabled ? colors.textDisabled : colors.error,
  };

  const btnFoulStyle: CSSProperties = {
    ...btnStyle,
    color: disabled ? colors.textDisabled : colors.textSecondary,
  };

  const goalRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: spacing.xs,
  };

  const actionRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.xs,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={teamNameStyle}>{teamName}</div>
        <div style={teamLabelStyle}>{teamLabel}</div>
      </div>

      {/* Score */}
      <div style={scoreStyle}>{score}</div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        {/* Goal + Minus */}
        <div style={goalRowStyle}>
          <button
            style={btnGoalStyle}
            onClick={onGoal}
            disabled={disabled}
            type="button"
            aria-label={`Tor für ${teamName}`}
          >
            + TOR
          </button>
          <button
            style={btnMinusStyle}
            onClick={onMinus}
            disabled={disabled || !canDecrement}
            type="button"
            aria-label={`Tor für ${teamName} entfernen`}
          >
            −1
          </button>
        </div>

        {/* 2 MIN Penalty - prominent */}
        <button
          style={btnPenaltyStyle}
          onClick={onPenalty}
          disabled={disabled}
          type="button"
          aria-label={`Zeitstrafe für ${teamName}`}
        >
          ⏱ 2 MIN{!isMobile && ' STRAFE'}
        </button>

        {/* Yellow | Red */}
        <div style={actionRowStyle}>
          <button
            style={btnYellowStyle}
            onClick={onYellowCard}
            disabled={disabled}
            type="button"
            aria-label={`Gelbe Karte für ${teamName}`}
          >
            🟨 Gelb
          </button>
          <button
            style={btnRedStyle}
            onClick={onRedCard}
            disabled={disabled}
            type="button"
            aria-label={`Rote Karte für ${teamName}`}
          >
            🟥 Rot
          </button>
        </div>

        {/* Substitution | Foul */}
        <div style={actionRowStyle}>
          <button
            style={btnStyle}
            onClick={onSubstitution}
            disabled={disabled}
            type="button"
            aria-label={`Wechsel für ${teamName}`}
          >
            🔄 Wechsel
          </button>
          <button
            style={btnFoulStyle}
            onClick={onFoul}
            disabled={disabled}
            type="button"
            aria-label={`Foul für ${teamName}`}
          >
            ⚠ Foul
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamBlock;
