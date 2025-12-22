/**
 * PenaltyShootoutDialog - Dialog for entering penalty shootout scores
 *
 * Simple score input for both teams, with validation that scores are different.
 */

import { CSSProperties, useState } from 'react';
import { theme } from '../../styles/theme';
import { Button } from '../ui';
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
  const [homeScore, setHomeScore] = useState(match.penaltyScoreA || 0);
  const [awayScore, setAwayScore] = useState(match.penaltyScoreB || 0);
  const [error, setError] = useState<string | null>(null);

  const isMobile = window.innerWidth < 768;

  const handleSubmit = () => {
    if (homeScore === awayScore) {
      setError('Das Elfmeterschießen muss einen Sieger haben!');
      return;
    }
    setError(null);
    onSubmit(match.id, homeScore, awayScore);
  };

  const containerStyle: CSSProperties = {
    marginTop: theme.spacing.md,
    padding: isMobile ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    border: `2px solid ${theme.colors.secondary}`,
    background: 'linear-gradient(135deg, rgba(0, 176, 255, 0.15), rgba(0, 120, 200, 0.1))',
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.lg : theme.fontSizes.md,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.secondary,
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  };

  const scoreInputContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isMobile ? theme.spacing.lg : theme.spacing.xl,
    marginBottom: theme.spacing.md,
  };

  const teamScoreBlockStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    maxWidth: '120px',
  };

  const scoreControlsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const scoreButtonStyle: CSSProperties = {
    width: isMobile ? '48px' : '36px',
    height: isMobile ? '48px' : '36px',
    borderRadius: '50%',
    border: `1px solid ${theme.colors.border}`,
    background: 'rgba(255, 255, 255, 0.1)',
    color: theme.colors.text.primary,
    fontSize: isMobile ? theme.fontSizes.xl : theme.fontSizes.lg,
    fontWeight: theme.fontWeights.bold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  };

  const scoreDisplayStyle: CSSProperties = {
    fontSize: isMobile ? '48px' : '36px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    minWidth: isMobile ? '60px' : '48px',
    textAlign: 'center',
  };

  const vsStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.lg : theme.fontSizes.md,
    color: theme.colors.text.secondary,
    fontWeight: theme.fontWeights.semibold,
  };

  const regularScoreStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  };

  const errorStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  };

  const buttonsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  };

  // Calculate total scores for display
  const totalHomeScore = match.homeScore + (match.overtimeScoreA || 0);
  const totalAwayScore = match.awayScore + (match.overtimeScoreB || 0);

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>
        <span>Strafstoßschießen</span>
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
