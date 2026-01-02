/**
 * TeamBlock - Score + Actions for one team
 *
 * Based on mockup: scoreboard-desktop.html
 * Contains: Team name, HEIM/GAST label, score, all action buttons
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens'
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
  /** Team side for data-testid attributes */
  side?: 'home' | 'away';
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
  side,
  onGoal,
  onMinus,
  onPenalty,
  onYellowCard,
  onRedCard,
  onSubstitution,
  onFoul,
  canDecrement = true,
}) => {
  // Derive side from teamLabel if not provided
  const teamSide = side ?? (teamLabel === 'Heim' ? 'home' : 'away');
  const isMobile = breakpoint === 'mobile';

  // ---------------------------------------------------------------------------
  // Styles - Based on mockup
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    background: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.lg,
    padding: isMobile ? cssVars.spacing.sm : cssVars.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? cssVars.spacing.xs : cssVars.spacing.sm,
  };

  const headerStyle: CSSProperties = {
    textAlign: 'center',
    marginBottom: isMobile ? cssVars.spacing.xs : cssVars.spacing.sm,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: isMobile ? '14px' : '22px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
  };

  const teamLabelStyle: CSSProperties = {
    fontSize: isMobile ? '10px' : '11px',
    color: cssVars.colors.textMuted,
    textTransform: 'uppercase',
  };

  const scoreStyle: CSSProperties = {
    fontSize: isMobile ? '64px' : '80px',
    fontWeight: cssVars.fontWeights.bold,
    textAlign: 'center',
    lineHeight: 1,
    color: cssVars.colors.textPrimary,
    margin: `${cssVars.spacing.sm} 0`,
  };

  // Button base style
  const btnStyle: CSSProperties = {
    fontFamily: 'inherit',
    border: `1px solid ${cssVars.colors.borderSolid}`,
    borderRadius: cssVars.borderRadius.md,
    padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.xs}` : cssVars.spacing.md,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    background: cssVars.colors.background,
    color: disabled ? cssVars.colors.textDisabled : cssVars.colors.textPrimary,
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s',
    // Mobile touch improvements - prevent 300ms delay and double-tap zoom
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  };

  const btnGoalStyle: CSSProperties = {
    ...btnStyle,
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    padding: isMobile ? `${cssVars.spacing.md} ${cssVars.spacing.sm}` : cssVars.spacing.lg,
    fontSize: isMobile ? '14px' : '15px',
    fontWeight: cssVars.fontWeights.bold,
    flex: 1,
  };

  const btnMinusStyle: CSSProperties = {
    ...btnStyle,
    background: cssVars.colors.background,
    color: disabled || !canDecrement ? cssVars.colors.textDisabled : cssVars.colors.error,
    borderColor: disabled || !canDecrement ? cssVars.colors.borderSolid : cssVars.colors.error,
    minWidth: '44px', // WCAG: 44px minimum touch target
    opacity: disabled || !canDecrement ? 0.5 : 1,
    cursor: disabled || !canDecrement ? 'not-allowed' : 'pointer',
  };

  const btnPenaltyStyle: CSSProperties = {
    ...btnStyle,
    background: cssVars.colors.background,
    borderColor: cssVars.colors.warning,
    color: cssVars.colors.warning,
    padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.md}` : `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    fontSize: isMobile ? '12px' : '14px',
  };

  const btnYellowStyle: CSSProperties = {
    ...btnStyle,
    color: disabled ? cssVars.colors.textDisabled : cssVars.colors.warning,
  };

  const btnRedStyle: CSSProperties = {
    ...btnStyle,
    color: disabled ? cssVars.colors.textDisabled : cssVars.colors.error,
  };

  const btnFoulStyle: CSSProperties = {
    ...btnStyle,
    color: disabled ? cssVars.colors.textDisabled : cssVars.colors.textSecondary,
  };

  const goalRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: cssVars.spacing.xs,
  };

  const actionRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: cssVars.spacing.xs,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={teamNameStyle} data-testid={`team-name-${teamSide}`}>{teamName}</div>
        <div style={teamLabelStyle}>{teamLabel}</div>
      </div>

      {/* Score */}
      <div style={scoreStyle} data-testid={`score-${teamSide}`}>{score}</div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
        {/* Goal + Minus */}
        <div style={goalRowStyle}>
          <button
            style={btnGoalStyle}
            onClick={onGoal}
            disabled={disabled}
            type="button"
            aria-label={`Tor für ${teamName}`}
            data-testid={`goal-button-${teamSide}`}
          >
            + TOR
          </button>
          <button
            style={btnMinusStyle}
            onClick={onMinus}
            disabled={disabled || !canDecrement}
            type="button"
            aria-label={`Tor für ${teamName} entfernen`}
            data-testid={`goal-minus-button-${teamSide}`}
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
