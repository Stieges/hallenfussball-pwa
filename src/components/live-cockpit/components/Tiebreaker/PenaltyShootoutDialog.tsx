/**
 * PenaltyShootoutDialog - Penalty Shootout Tracking UI
 *
 * Full-screen dialog for tracking penalty shootout progress.
 * Features:
 * - Round-by-round tracking (up to 10 rounds)
 * - Auto-detection when winner is determined
 * - Undo for last shot
 * - Alternating team turns
 *
 * @see docs/concepts/LIVE-SCREEN-REDESIGN.md#3.10
 */

import { useState, useMemo, type CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../../design-tokens';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import moduleStyles from '../../LiveCockpit.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PenaltyShot {
  round: number;
  team: 'home' | 'away';
  scored: boolean;
}

interface PenaltyShootoutDialogProps {
  homeTeamName: string;
  awayTeamName: string;
  /** Initial shots (for resuming) */
  initialShots?: PenaltyShot[];
  /** Called when a shot is recorded */
  onRecordShot: (team: 'home' | 'away', scored: boolean) => void;
  /** Called when shootout is finished */
  onFinish: (homeScore: number, awayScore: number) => void;
  /** Cancel/close handler */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const calculateScore = (shots: PenaltyShot[], team: 'home' | 'away'): number => {
  return shots.filter(s => s.team === team && s.scored).length;
};

const isShootoutDecided = (shots: PenaltyShot[]): boolean => {
  const homeScore = calculateScore(shots, 'home');
  const awayScore = calculateScore(shots, 'away');
  const homeShots = shots.filter(s => s.team === 'home').length;
  const awayShots = shots.filter(s => s.team === 'away').length;

  // Minimum 5 rounds each (if still tied, continue)
  if (homeShots < 5 || awayShots < 5) {
    // Check if one team can't catch up
    const remainingHome = 5 - homeShots;
    const remainingAway = 5 - awayShots;

    // If team is behind and can't catch up even if they score all remaining
    if (homeScore + remainingHome < awayScore && awayShots >= homeShots) {
      return true;
    }
    if (awayScore + remainingAway < homeScore && homeShots >= awayShots) {
      return true;
    }
    return false;
  }

  // After 5 rounds, sudden death - decided when scores differ after equal shots
  if (homeShots === awayShots && homeScore !== awayScore) {
    return true;
  }

  return false;
};

const getNextTeam = (shots: PenaltyShot[]): 'home' | 'away' => {
  const homeShots = shots.filter(s => s.team === 'home').length;
  const awayShots = shots.filter(s => s.team === 'away').length;

  // Home shoots first, then alternate
  if (homeShots <= awayShots) {
    return 'home';
  }
  return 'away';
};

const getCurrentRound = (shots: PenaltyShot[]): number => {
  const homeShots = shots.filter(s => s.team === 'home').length;
  const awayShots = shots.filter(s => s.team === 'away').length;
  return Math.max(1, Math.min(homeShots, awayShots) + 1);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PenaltyShootoutDialog: React.FC<PenaltyShootoutDialogProps> = ({
  homeTeamName,
  awayTeamName,
  initialShots = [],
  onRecordShot,
  onFinish,
  onCancel,
}) => {
  const isMobile = useIsMobile();
  const [shots, setShots] = useState<PenaltyShot[]>(initialShots);

  // Computed values
  const homeScore = useMemo(() => calculateScore(shots, 'home'), [shots]);
  const awayScore = useMemo(() => calculateScore(shots, 'away'), [shots]);
  const isDecided = useMemo(() => isShootoutDecided(shots), [shots]);
  const nextTeam = useMemo(() => getNextTeam(shots), [shots]);
  const currentRound = useMemo(() => getCurrentRound(shots), [shots]);
  const nextTeamName = nextTeam === 'home' ? homeTeamName : awayTeamName;

  // Handlers
  const handleShot = (scored: boolean) => {
    const round = currentRound;
    const team = nextTeam;

    const newShot: PenaltyShot = { round, team, scored };
    setShots(prev => [...prev, newShot]);
    onRecordShot(team, scored);
  };

  const handleUndo = () => {
    if (shots.length > 0) {
      setShots(prev => prev.slice(0, -1));
    }
  };

  const handleFinish = () => {
    onFinish(homeScore, awayScore);
  };

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: colors.background,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    overflow: 'auto',
  };

  const headerStyle: CSSProperties = {
    padding: isMobile ? spacing.md : spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.lg : fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    padding: isMobile ? spacing.md : spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xl,
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%',
  };

  const teamsRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: spacing.lg,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  };

  const scoreDisplayStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    background: colors.surfaceDark,
    borderRadius: borderRadius.lg,
    width: '100%',
  };

  const scoreStyle: CSSProperties = {
    fontSize: isMobile ? '48px' : '64px',
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
  };

  const separatorStyle: CSSProperties = {
    fontSize: isMobile ? '32px' : '40px',
    color: colors.textSecondary,
  };

  const roundsContainerStyle: CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  };

  const roundRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '60px 1fr 1fr',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    background: colors.surfaceDark,
  };

  const roundLabelStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const shotResultStyle = (scored: boolean | null): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.lg,
    color: scored === null
      ? colors.textMuted
      : scored
        ? colors.primary
        : colors.error,
  });

  const promptStyle: CSSProperties = {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.md,
    background: colors.surfaceLight,
    borderRadius: borderRadius.md,
    width: '100%',
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.md,
    width: '100%',
  };

  const actionButtonStyle = (variant: 'goal' | 'miss'): CSSProperties => ({
    flex: 1,
    padding: isMobile ? spacing.lg : spacing.md,
    fontSize: isMobile ? fontSizes.lg : fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: variant === 'goal' ? colors.onPrimary : colors.textPrimary,
    background: variant === 'goal'
      ? `linear-gradient(135deg, ${colors.primary}, ${colors.primaryHover})`
      : colors.surfaceLight,
    border: variant === 'miss' ? `1px solid ${colors.border}` : 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  });

  const footerStyle: CSSProperties = {
    padding: isMobile ? spacing.md : spacing.lg,
    borderTop: `1px solid ${colors.border}`,
    display: 'flex',
    gap: spacing.md,
    justifyContent: 'center',
  };

  const footerButtonStyle = (variant: 'primary' | 'secondary' | 'ghost'): CSSProperties => ({
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: variant === 'primary' ? colors.onPrimary : colors.textSecondary,
    background: variant === 'primary' ? colors.primary : 'transparent',
    border: variant === 'ghost' ? `1px solid ${colors.border}` : 'none',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const getShotResult = (round: number, team: 'home' | 'away'): boolean | null => {
    const shot = shots.find(s => s.round === round && s.team === team);
    return shot ? shot.scored : null;
  };

  const renderRound = (round: number) => {
    const homeResult = getShotResult(round, 'home');
    const awayResult = getShotResult(round, 'away');

    return (
      <div key={round} style={roundRowStyle}>
        <span style={roundLabelStyle}>{round}</span>
        <span style={shotResultStyle(homeResult)}>
          {homeResult === null ? '—' : homeResult ? '⚽' : '✖'}
        </span>
        <span style={shotResultStyle(awayResult)}>
          {awayResult === null ? '—' : awayResult ? '⚽' : '✖'}
        </span>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={overlayStyle} className={moduleStyles.dialogOverlay}>
      {/* Header */}
      <header style={headerStyle}>
        <span style={titleStyle}>
          <span>⚽</span>
          <span>Elfmeterschießen</span>
        </span>
      </header>

      {/* Content */}
      <main style={contentStyle}>
        {/* Team Names */}
        <div style={teamsRowStyle}>
          <span style={teamNameStyle}>{homeTeamName}</span>
          <span style={teamNameStyle}>{awayTeamName}</span>
        </div>

        {/* Score */}
        <div style={scoreDisplayStyle}>
          <span style={scoreStyle}>{homeScore}</span>
          <span style={separatorStyle}>:</span>
          <span style={scoreStyle}>{awayScore}</span>
        </div>

        {/* Rounds Table */}
        <div style={roundsContainerStyle}>
          {/* Header */}
          <div style={{ ...roundRowStyle, background: 'transparent' }}>
            <span style={{ ...roundLabelStyle, fontWeight: fontWeights.semibold }}>Runde</span>
            <span style={{ ...roundLabelStyle, fontWeight: fontWeights.semibold }}>{homeTeamName}</span>
            <span style={{ ...roundLabelStyle, fontWeight: fontWeights.semibold }}>{awayTeamName}</span>
          </div>

          {/* Rounds 1-5 (or more for sudden death) */}
          {Array.from({ length: Math.max(5, currentRound) }, (_, i) => i + 1).map(renderRound)}
        </div>

        {/* Current Turn Prompt or Decision */}
        {isDecided ? (
          <div style={{ ...promptStyle, background: colors.primaryLight, color: colors.primary }}>
            ✓ {homeScore > awayScore ? homeTeamName : awayTeamName} gewinnt das Elfmeterschießen!
          </div>
        ) : (
          <>
            <div style={promptStyle}>
              Runde {currentRound}: <strong>{nextTeamName}</strong> schießt
            </div>

            {/* Shot Buttons */}
            <div style={actionsStyle}>
              <button
                style={actionButtonStyle('goal')}
                onClick={() => handleShot(true)}
                type="button"
              >
                <span>⚽</span>
                <span>TOR</span>
              </button>
              <button
                style={actionButtonStyle('miss')}
                onClick={() => handleShot(false)}
                type="button"
              >
                <span>✖</span>
                <span>DANEBEN</span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={footerStyle}>
        {shots.length > 0 && !isDecided && (
          <button
            style={footerButtonStyle('ghost')}
            onClick={handleUndo}
            type="button"
          >
            ↶ Letzten Schuss korrigieren
          </button>
        )}

        <button
          style={footerButtonStyle('ghost')}
          onClick={onCancel}
          type="button"
        >
          Abbrechen
        </button>

        {isDecided && (
          <button
            style={footerButtonStyle('primary')}
            onClick={handleFinish}
            type="button"
          >
            ✓ Elfmeterschießen beenden
          </button>
        )}
      </footer>
    </div>
  );
};

export default PenaltyShootoutDialog;
