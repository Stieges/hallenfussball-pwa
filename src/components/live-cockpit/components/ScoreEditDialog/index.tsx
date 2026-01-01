/**
 * ScoreEditDialog - Dialog for manually correcting the score
 */

import { useState, type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens'
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
    background: cssVars.colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: cssVars.spacing.md,
  };

  const dialogStyle: CSSProperties = {
    background: cssVars.colors.surfaceSolid,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.lg,
    maxWidth: '350px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    textAlign: 'center',
  };

  const scoreContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.md,
  };

  const teamScoreStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
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
    fontWeight: cssVars.fontWeights.bold,
    textAlign: 'center',
    background: cssVars.colors.surface,
    border: `2px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
  };

  const separatorStyle: CSSProperties = {
    fontSize: '2rem',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textSecondary,
  };

  const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.sm,
  };

  const buttonStyle = (isPrimary: boolean): CSSProperties => ({
    flex: 1,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: isPrimary ? cssVars.colors.onPrimary : cssVars.colors.textPrimary,
    background: isPrimary ? cssVars.colors.primary : cssVars.colors.surface,
    border: isPrimary ? 'none' : `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
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
