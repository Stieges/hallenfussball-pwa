/**
 * TiebreakerBanner - Tiebreaker Decision UI
 *
 * Appears when a final match ends in a draw and requires resolution.
 * Shows available options based on tournament configuration.
 *
 * @see docs/concepts/LIVE-SCREEN-REDESIGN.md#3.9
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens'
import { useIsMobile } from '../../../../hooks/useIsMobile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TiebreakerMode = 'shootout' | 'overtime-then-shootout' | 'goldenGoal';

interface TiebreakerBannerProps {
  /** Home team name */
  homeTeamName: string;
  /** Away team name */
  awayTeamName: string;
  /** Current score (both same since it's a draw) */
  score: number;
  /** Tournament's configured tiebreaker mode */
  tiebreakerMode?: TiebreakerMode;
  /** Overtime duration in minutes (if applicable) */
  overtimeMinutes?: number;
  /** Start overtime handler */
  onStartOvertime?: () => void;
  /** Start golden goal handler */
  onStartGoldenGoal?: () => void;
  /** Start penalty shootout handler */
  onStartPenaltyShootout?: () => void;
  /** End as draw handler */
  onEndAsDraw?: () => void;
  /** Cancel/dismiss handler */
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TiebreakerBanner: React.FC<TiebreakerBannerProps> = ({
  homeTeamName,
  awayTeamName,
  score,
  tiebreakerMode = 'shootout',
  overtimeMinutes = 5,
  onStartOvertime,
  onStartGoldenGoal,
  onStartPenaltyShootout,
  onEndAsDraw,
  onCancel: _onCancel,
}) => {
  const isMobile = useIsMobile();

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: cssVars.colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: cssVars.spacing.lg,
    zIndex: 1000,
  };

  const bannerStyle: CSSProperties = {
    width: '100%',
    maxWidth: '500px',
    background: `linear-gradient(135deg, ${cssVars.colors.panelGradientStart}, ${cssVars.colors.panelGradientEnd})`,
    borderRadius: cssVars.borderRadius.xl,
    border: `2px solid ${cssVars.colors.warning}`,
    boxShadow: `0 8px 32px ${cssVars.colors.warning}30`,
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    background: `${cssVars.colors.warning}20`,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    borderBottom: `1px solid ${cssVars.colors.warning}40`,
  };

  const warningIconStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
  };

  const headerTextStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.warning,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const contentStyle: CSSProperties = {
    padding: isMobile ? cssVars.spacing.lg : cssVars.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.lg,
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const scoreStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.xl : '32px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    textAlign: 'center',
  };

  const teamNamesStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
  };

  const descriptionStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 1.5,
  };

  const actionsStyle: CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const dividerStyle: CSSProperties = {
    width: '100%',
    height: '1px',
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.sm} 0`,
  };

  const secondaryActionsStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getModeDescription = () => {
    switch (tiebreakerMode) {
      case 'overtime-then-shootout':
        return `Gemäß Turnierregeln wird das Spiel durch Verlängerung (${overtimeMinutes} Min.) und ggf. Elfmeterschießen entschieden.`;
      case 'goldenGoal':
        return 'Gemäß Turnierregeln wird das Spiel durch Golden Goal entschieden.';
      case 'shootout':
      default:
        return 'Gemäß Turnierregeln wird das Spiel durch Elfmeterschießen entschieden.';
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={overlayStyle} role="alertdialog" aria-labelledby="tiebreaker-title">
      <div style={bannerStyle}>
        {/* Warning Header */}
        <div style={headerStyle}>
          <span style={warningIconStyle}>⚠️</span>
          <span style={headerTextStyle}>Achtung</span>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          <div style={titleStyle} id="tiebreaker-title">
            <span>⚖️</span>
            <span>Unentschieden im Finalspiel</span>
          </div>

          <div style={scoreStyle}>
            {score} : {score}
          </div>

          <div style={teamNamesStyle}>
            {homeTeamName} vs {awayTeamName}
          </div>

          <div style={descriptionStyle}>
            {getModeDescription()}
          </div>

          {/* Primary Action */}
          <div style={actionsStyle}>
            {tiebreakerMode === 'overtime-then-shootout' && onStartOvertime && (
              <PrimaryButton onClick={onStartOvertime}>
                ▶️ Verlängerung starten ({overtimeMinutes} Min.)
              </PrimaryButton>
            )}

            {tiebreakerMode === 'goldenGoal' && onStartGoldenGoal && (
              <PrimaryButton onClick={onStartGoldenGoal}>
                ▶️ Golden Goal starten
              </PrimaryButton>
            )}

            {tiebreakerMode === 'shootout' && onStartPenaltyShootout && (
              <PrimaryButton onClick={onStartPenaltyShootout}>
                ⚽ Elfmeterschießen starten
              </PrimaryButton>
            )}

            <div style={dividerStyle} />

            {/* Secondary Actions */}
            <div style={secondaryActionsStyle}>
              {tiebreakerMode !== 'shootout' && onStartPenaltyShootout && (
                <SecondaryButton onClick={onStartPenaltyShootout}>
                  Direkt zum Elfmeterschießen
                </SecondaryButton>
              )}

              {onEndAsDraw && (
                <SecondaryButton onClick={onEndAsDraw} variant="ghost">
                  Als Unentschieden beenden
                </SecondaryButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}

const PrimaryButton: React.FC<ButtonProps> = ({ onClick, children }) => {
  const style: CSSProperties = {
    width: '100%',
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.onPrimary,
    background: `linear-gradient(135deg, ${cssVars.colors.primary}, ${cssVars.colors.primaryHover})`,
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    boxShadow: `0 4px 15px ${cssVars.colors.primary}40`,
    transition: 'all 0.15s ease',
  };

  return (
    <button style={style} onClick={onClick} type="button">
      {children}
    </button>
  );
};

const SecondaryButton: React.FC<ButtonProps> = ({ onClick, children, variant = 'secondary' }) => {
  const isGhost = variant === 'ghost';

  const style: CSSProperties = {
    flex: 1,
    minWidth: '140px',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: isGhost ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
    background: isGhost ? 'transparent' : cssVars.colors.surfaceLight,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  return (
    <button style={style} onClick={onClick} type="button">
      {children}
    </button>
  );
};

export default TiebreakerBanner;
