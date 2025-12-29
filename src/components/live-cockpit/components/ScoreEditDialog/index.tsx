/**
 * ScoreEditDialog - Dialog for manually correcting the score
 */

import { useState, type CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../../design-tokens';
import moduleStyles from '../../LiveCockpit.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (homeScore: number, awayScore: number) => void;
  currentHomeScore: number;
  currentAwayScore: number;
  homeTeamName: string;
  awayTeamName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ScoreEditDialog: React.FC<ScoreEditDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentHomeScore,
  currentAwayScore,
  homeTeamName,
  awayTeamName,
}) => {
  const [homeScore, setHomeScore] = useState(currentHomeScore);
  const [awayScore, setAwayScore] = useState(currentAwayScore);

  // Reset when dialog opens
  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm(homeScore, awayScore);
    onClose();
  };

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: spacing.md,
  };

  const dialogStyle: CSSProperties = {
    background: colors.surfaceSolid,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxWidth: '350px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  };

  const scoreContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  };

  const teamScoreStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xs,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const inputStyle: CSSProperties = {
    width: '60px',
    height: '60px',
    fontSize: '2rem',
    fontWeight: fontWeights.bold,
    textAlign: 'center',
    background: colors.surface,
    border: `2px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    color: colors.textPrimary,
  };

  const separatorStyle: CSSProperties = {
    fontSize: '2rem',
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
  };

  const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
    marginTop: spacing.sm,
  };

  const buttonStyle = (isPrimary: boolean): CSSProperties => ({
    flex: 1,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: isPrimary ? colors.onPrimary : colors.textPrimary,
    background: isPrimary ? colors.primary : colors.surface,
    border: isPrimary ? 'none' : `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={overlayStyle} className={moduleStyles.dialogOverlay} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>Ergebnis korrigieren</h2>

        <div style={scoreContainerStyle}>
          <div style={teamScoreStyle}>
            <span style={teamNameStyle}>{homeTeamName}</span>
            <input
              type="number"
              min="0"
              max="99"
              value={homeScore}
              onChange={(e) => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
              style={inputStyle}
              aria-label={`Tore ${homeTeamName}`}
            />
          </div>

          <span style={separatorStyle}>:</span>

          <div style={teamScoreStyle}>
            <span style={teamNameStyle}>{awayTeamName}</span>
            <input
              type="number"
              min="0"
              max="99"
              value={awayScore}
              onChange={(e) => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
              style={inputStyle}
              aria-label={`Tore ${awayTeamName}`}
            />
          </div>
        </div>

        <div style={buttonContainerStyle}>
          <button
            type="button"
            style={buttonStyle(false)}
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            type="button"
            style={buttonStyle(true)}
            onClick={handleConfirm}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScoreEditDialog;
