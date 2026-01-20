/**
 * PenaltyShootoutDialog - Dialog for entering penalty shootout scores
 *
 * Simple score input for both teams, with validation that scores are different.
 */

import { CSSProperties, useState, useCallback } from 'react';
import { cssVars } from '../../design-tokens'
import { Button } from '../ui';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { LiveMatch } from './MatchCockpit';

interface PenaltyShootoutDialogProps {
  match: LiveMatch;
  onSubmit: (matchId: string, homeScore: number, awayScore: number) => void;
  onCancel: (matchId: string) => void;
}

export const PenaltyShootoutDialog: React.FC<PenaltyShootoutDialogProps> = ({
  match,
  onSubmit,
  onCancel,
}) => {
  const [homeScore, setHomeScore] = useState(match.penaltyScoreA ?? 0);
  const [awayScore, setAwayScore] = useState(match.penaltyScoreB ?? 0);
  const [error, setError] = useState<string | null>(null);

  const isMobile = useIsMobile();

  // ESC handler for focus trap
  const handleEscape = useCallback(() => {
    onCancel(match.id);
  }, [onCancel, match.id]);

  // Focus trap for accessibility (WCAG 4.1.3)
  const focusTrap = useFocusTrap({
    isActive: true, // Always active when component is rendered
    onEscape: handleEscape,
  });

  const handleSubmit = () => {
    if (homeScore === awayScore) {
      setError('Das Elfmeterschießen muss einen Sieger haben!');
      return;
    }
    setError(null);
    onSubmit(match.id, homeScore, awayScore);
  };

  const containerStyle: CSSProperties = {
    marginTop: cssVars.spacing.md,
    padding: isMobile ? cssVars.spacing.lg : cssVars.spacing.md,
    borderRadius: cssVars.borderRadius.lg,
    border: `2px solid ${cssVars.colors.secondary}`,
    background: 'linear-gradient(135deg, rgba(0, 176, 255, 0.15), rgba(0, 120, 200, 0.1))',
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.secondary,
    marginBottom: cssVars.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    justifyContent: 'center',
  };

  const scoreInputContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isMobile ? cssVars.spacing.lg : cssVars.spacing.xl,
    marginBottom: cssVars.spacing.md,
  };

  const teamScoreBlockStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    textAlign: 'center',
    maxWidth: '120px',
  };

  const scoreControlsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const scoreButtonStyle: CSSProperties = {
    width: isMobile ? '48px' : '36px',
    height: isMobile ? '48px' : '36px',
    borderRadius: '50%',
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.surfaceLight,
    color: cssVars.colors.textPrimary,
    fontSize: isMobile ? cssVars.fontSizes.xl : cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  };

  const scoreDisplayStyle: CSSProperties = {
    fontSize: isMobile ? '48px' : '36px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    minWidth: isMobile ? '60px' : '48px',
    textAlign: 'center',
  };

  const vsStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    fontWeight: cssVars.fontWeights.semibold,
  };

  const regularScoreStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
    marginBottom: cssVars.spacing.md,
  };

  const errorStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.error,
    textAlign: 'center',
    marginBottom: cssVars.spacing.sm,
  };

  const buttonsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: cssVars.spacing.sm,
    justifyContent: 'center',
  };

  // Calculate total scores for display
  const totalHomeScore = match.homeScore + (match.overtimeScoreA ?? 0);
  const totalAwayScore = match.awayScore + (match.overtimeScoreB ?? 0);

  return (
    <div
      ref={focusTrap.containerRef}
      style={containerStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="penalty-shootout-title"
    >
      <div style={titleStyle}>
        <span id="penalty-shootout-title">Strafstoßschießen</span>
      </div>

      <div style={regularScoreStyle}>
        Spielstand nach {match.playPhase === 'overtime' || match.playPhase === 'goldenGoal' ? 'Verlängerung' : 'regulärer Spielzeit'}:{' '}
        <strong>{totalHomeScore} : {totalAwayScore}</strong>
      </div>

      <div style={scoreInputContainerStyle}>
        <div style={teamScoreBlockStyle}>
          <div style={teamNameStyle}>{match.homeTeam.name}</div>
          <div style={scoreControlsStyle}>
            <button
              style={scoreButtonStyle}
              onClick={() => setHomeScore(Math.max(0, homeScore - 1))}
              disabled={homeScore === 0}
            >
              −
            </button>
            <div style={scoreDisplayStyle}>{homeScore}</div>
            <button
              style={scoreButtonStyle}
              onClick={() => setHomeScore(homeScore + 1)}
            >
              +
            </button>
          </div>
        </div>

        <div style={vsStyle}>:</div>

        <div style={teamScoreBlockStyle}>
          <div style={teamNameStyle}>{match.awayTeam.name}</div>
          <div style={scoreControlsStyle}>
            <button
              style={scoreButtonStyle}
              onClick={() => setAwayScore(Math.max(0, awayScore - 1))}
              disabled={awayScore === 0}
            >
              −
            </button>
            <div style={scoreDisplayStyle}>{awayScore}</div>
            <button
              style={scoreButtonStyle}
              onClick={() => setAwayScore(awayScore + 1)}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={buttonsStyle}>
        <Button
          variant="primary"
          size={isMobile ? 'md' : 'sm'}
          onClick={handleSubmit}
          style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
        >
          Ergebnis bestätigen
        </Button>
        <Button
          variant="secondary"
          size={isMobile ? 'md' : 'sm'}
          onClick={() => onCancel(match.id)}
          style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
        >
          Zurück
        </Button>
      </div>
    </div>
  );
};
