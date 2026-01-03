/**
 * TeamBlock - Individual team display with score and goal controls
 *
 * MF-004: Added aria-labels for accessibility
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { Button, TeamAvatar } from '../../ui';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { MatchStatus } from '../MatchCockpit';
import type { TeamLogo, TeamColors } from '../../../types/tournament';

export interface TeamBlockProps {
  label: string;
  team: { id: string; name: string; logo?: TeamLogo; colors?: TeamColors };
  score: number;
  status: MatchStatus;
  awaitingTiebreakerChoice?: boolean;
  onGoal(delta: 1 | -1): void;
  align?: 'left' | 'right';
}

const TeamBlockComponent: React.FC<TeamBlockProps> = ({
  label,
  team,
  score,
  status,
  awaitingTiebreakerChoice,
  onGoal,
  align = 'left',
}) => {
  const isMobile = useIsMobile();

  const blockStyle: CSSProperties = {
    padding: isMobile ? cssVars.spacing.lg : cssVars.spacing.md,
    borderRadius: cssVars.borderRadius.lg,
    background: `linear-gradient(135deg, ${cssVars.colors.panelGradientStart}, ${cssVars.colors.panelGradientEnd})`,
    border: `1px solid ${cssVars.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? cssVars.spacing.sm : '6px',
    alignItems: isMobile ? 'flex-start' : (align === 'right' ? 'flex-end' : 'flex-start'),
  };

  const labelStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: cssVars.colors.textSecondary,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.xl : cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
  };

  const scoreStyle: CSSProperties = {
    fontSize: isMobile ? '48px' : '30px',
    fontWeight: cssVars.fontWeights.bold,
    marginTop: '2px',
  };

  const controlsStyle: CSSProperties = {
    marginTop: cssVars.spacing.xs,
    display: 'flex',
    gap: isMobile ? cssVars.spacing.sm : '6px',
    flexWrap: 'wrap',
    width: isMobile ? '100%' : 'auto',
  };

  return (
    <div style={blockStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
        <TeamAvatar team={team} size="sm" showColorRing />
        <span style={teamNameStyle}>{team.name}</span>
      </div>
      {/* MF-004: Score mit aria-label für Screen-Reader */}
      <div
        style={scoreStyle}
        aria-label={`Torstand ${team.name}: ${score}`}
        role="text"
      >
        {score}
      </div>

      <div style={controlsStyle}>
        {/* MF-004: aria-label für Tor-Button */}
        <Button
          variant="primary"
          size={isMobile ? "md" : "sm"}
          onClick={() => onGoal(1)}
          style={{ flex: isMobile ? '1' : '0 1 auto', minHeight: isMobile ? '48px' : 'auto' }}
          disabled={status === 'FINISHED' || awaitingTiebreakerChoice}
          aria-label={`Tor für ${team.name} hinzufügen`}
        >
          Tor {team.name}
        </Button>
        {/* MF-004: aria-label für Tor-Zurücknehmen-Button */}
        <Button
          variant="secondary"
          size={isMobile ? "md" : "sm"}
          onClick={() => onGoal(-1)}
          style={{
            width: isMobile ? '48px' : '36px',
            minHeight: isMobile ? '48px' : 'auto',
            padding: '6px'
          }}
          disabled={score === 0 || status === 'FINISHED' || awaitingTiebreakerChoice}
          aria-label={`Tor für ${team.name} zurücknehmen`}
        >
          −
        </Button>
      </div>
    </div>
  );
};

// MF-002: React.memo für Performance-Optimierung
export const TeamBlock = React.memo(TeamBlockComponent, (prevProps, nextProps) => {
  return (
    prevProps.score === nextProps.score &&
    prevProps.status === nextProps.status &&
    prevProps.team.id === nextProps.team.id &&
    prevProps.team.name === nextProps.team.name &&
    prevProps.awaitingTiebreakerChoice === nextProps.awaitingTiebreakerChoice &&
    prevProps.align === nextProps.align
  );
});
