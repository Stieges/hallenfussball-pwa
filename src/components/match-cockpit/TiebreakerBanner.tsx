/**
 * TiebreakerBanner - Shown when a finals match ends in a draw
 *
 * Displays options based on the tournament's tiebreaker configuration:
 * - shootout: Direct penalty shootout
 * - overtime-then-shootout: Overtime first, then shootout if still draw
 * - goldenGoal: Golden goal overtime
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
import { Button } from '../ui';
import { useIsMobile } from '../../hooks/useIsMobile';
import { LiveMatch } from './MatchCockpit';

interface TiebreakerBannerProps {
  match: LiveMatch;
  onStartOvertime: (matchId: string) => void;
  onStartGoldenGoal: (matchId: string) => void;
  onStartPenaltyShootout: (matchId: string) => void;
  onForceFinish: (matchId: string) => void;
}

export const TiebreakerBanner: React.FC<TiebreakerBannerProps> = ({
  match,
  onStartOvertime,
  onStartGoldenGoal,
  onStartPenaltyShootout,
  onForceFinish,
}) => {
  const isMobile = useIsMobile();

  // Determine which phase we're in and what options to show
  const isAfterOvertime = match.playPhase === 'overtime' || match.playPhase === 'goldenGoal';
  const tiebreakerMode = match.tiebreakerMode || 'shootout';
  const overtimeMinutes = Math.round((match.overtimeDurationSeconds || 300) / 60);

  const containerStyle: CSSProperties = {
    marginTop: spacing.md,
    padding: isMobile ? spacing.lg : spacing.md,
    borderRadius: borderRadius.lg,
    border: `2px solid ${colors.warning}`,
    background: 'linear-gradient(135deg, rgba(255, 145, 0, 0.15), rgba(255, 100, 0, 0.1))',
    animation: 'pulse 2s ease-in-out infinite',
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.lg : fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.warning,
    marginBottom: spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const scoreStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.xl : fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    margin: `${spacing.md} 0`,
  };

  const messageStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.md : fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 1.5,
  };

  const buttonsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  };

  const buttonRowStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: spacing.sm,
  };

  const getTitle = () => {
    if (isAfterOvertime) {
      return match.playPhase === 'goldenGoal'
        ? 'Golden Goal ohne Entscheidung!'
        : 'Verlängerung endet Unentschieden!';
    }
    return 'Unentschieden im Finalspiel!';
  };

  const getScore = () => {
    const totalHome = match.homeScore + (match.overtimeScoreA || 0);
    const totalAway = match.awayScore + (match.overtimeScoreB || 0);
    return `${totalHome} : ${totalAway}`;
  };

  const getMessage = () => {
    if (isAfterOvertime) {
      return 'Auch nach der Verlängerung steht es unentschieden. Jetzt geht es ins Elfmeterschießen!';
    }

    switch (tiebreakerMode) {
      case 'shootout':
        return 'Das Spiel endet unentschieden. Gemäß Turnierregeln wird jetzt das Strafstoßschießen durchgeführt.';
      case 'overtime-then-shootout':
        return `Das Spiel endet unentschieden. Gemäß Turnierregeln folgt jetzt eine ${overtimeMinutes}-minütige Verlängerung.`;
      case 'goldenGoal':
        return `Das Spiel endet unentschieden. Gemäß Turnierregeln folgt jetzt eine ${overtimeMinutes}-minütige Golden-Goal-Phase.`;
      default:
        return 'Das Spiel endet unentschieden. Bitte wählen Sie wie fortgefahren werden soll.';
    }
  };

  const renderButtons = () => {
    // After overtime/golden goal ended in draw -> only penalty option
    if (isAfterOvertime) {
      return (
        <div style={buttonsStyle}>
          <Button
            variant="primary"
            size={isMobile ? 'md' : 'sm'}
            onClick={() => onStartPenaltyShootout(match.id)}
            style={{ minHeight: isMobile ? '48px' : 'auto' }}
          >
            Strafstoßschießen starten
          </Button>
          <Button
            variant="secondary"
            size={isMobile ? 'md' : 'sm'}
            onClick={() => onForceFinish(match.id)}
            style={{ minHeight: isMobile ? '48px' : 'auto' }}
          >
            Als Unentschieden beenden
          </Button>
        </div>
      );
    }

    // Based on tiebreaker mode
    switch (tiebreakerMode) {
      case 'shootout':
        return (
          <div style={buttonsStyle}>
            <Button
              variant="primary"
              size={isMobile ? 'md' : 'sm'}
              onClick={() => onStartPenaltyShootout(match.id)}
              style={{ minHeight: isMobile ? '48px' : 'auto' }}
            >
              Strafstoßschießen starten
            </Button>
            <Button
              variant="secondary"
              size={isMobile ? 'md' : 'sm'}
              onClick={() => onForceFinish(match.id)}
              style={{ minHeight: isMobile ? '48px' : 'auto' }}
            >
              Als Unentschieden beenden
            </Button>
          </div>
        );

      case 'overtime-then-shootout':
        return (
          <div style={buttonsStyle}>
            <Button
              variant="primary"
              size={isMobile ? 'md' : 'sm'}
              onClick={() => onStartOvertime(match.id)}
              style={{ minHeight: isMobile ? '48px' : 'auto' }}
            >
              Verlängerung starten ({overtimeMinutes} Min.)
            </Button>
            <div style={buttonRowStyle}>
              <Button
                variant="secondary"
                size={isMobile ? 'md' : 'sm'}
                onClick={() => onStartPenaltyShootout(match.id)}
                style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
              >
                Direkt zum Elfmeterschießen
              </Button>
              <Button
                variant="secondary"
                size={isMobile ? 'md' : 'sm'}
                onClick={() => onForceFinish(match.id)}
                style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
              >
                Als Unentschieden beenden
              </Button>
            </div>
          </div>
        );

      case 'goldenGoal':
        return (
          <div style={buttonsStyle}>
            <Button
              variant="primary"
              size={isMobile ? 'md' : 'sm'}
              onClick={() => onStartGoldenGoal(match.id)}
              style={{ minHeight: isMobile ? '48px' : 'auto' }}
            >
              Golden Goal starten ({overtimeMinutes} Min.)
            </Button>
            <div style={buttonRowStyle}>
              <Button
                variant="secondary"
                size={isMobile ? 'md' : 'sm'}
                onClick={() => onStartPenaltyShootout(match.id)}
                style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
              >
                Direkt zum Elfmeterschießen
              </Button>
              <Button
                variant="secondary"
                size={isMobile ? 'md' : 'sm'}
                onClick={() => onForceFinish(match.id)}
                style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
              >
                Als Unentschieden beenden
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>
        <span>⚖️</span>
        <span>{getTitle()}</span>
      </div>

      <div style={scoreStyle}>
        {match.homeTeam.name} {getScore()} {match.awayTeam.name}
      </div>

      <div style={messageStyle}>{getMessage()}</div>

      {renderButtons()}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
};
