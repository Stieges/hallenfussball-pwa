/**
 * EditScoreDialog - Dialog for manually editing match scores
 *
 * QW-001: Replaces window.prompt() with proper +/- button UI.
 * MF-004: Accessibility improvements (focus trap, Escape key, ARIA)
 */

import { CSSProperties, useState, useEffect, useCallback, useRef } from 'react';
import { cssVars } from '../../design-tokens'
import { Button } from '../ui';
import { useIsMobile } from '../../hooks/useIsMobile';

interface EditScoreDialogProps {
  homeTeamName: string;
  awayTeamName: string;
  currentHomeScore: number;
  currentAwayScore: number;
  onSubmit: (homeScore: number, awayScore: number) => void;
  onCancel: () => void;
}

export const EditScoreDialog: React.FC<EditScoreDialogProps> = ({
  homeTeamName,
  awayTeamName,
  currentHomeScore,
  currentAwayScore,
  onSubmit,
  onCancel,
}) => {
  const [homeScore, setHomeScore] = useState(currentHomeScore);
  const [awayScore, setAwayScore] = useState(currentAwayScore);

  const isMobile = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);

  // MF-004: Focus management and Escape key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    // Focus dialog container on mount
    setTimeout(() => dialogRef.current?.focus(), 50);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleSubmit = () => {
    onSubmit(homeScore, awayScore);
  };

  const hasChanged = homeScore !== currentHomeScore || awayScore !== currentAwayScore;

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
    zIndex: 1000,
    padding: cssVars.spacing.md,
  };

  const containerStyle: CSSProperties = {
    width: '100%',
    maxWidth: '500px',
    padding: isMobile ? cssVars.spacing.lg : cssVars.spacing.xl,
    borderRadius: cssVars.borderRadius.lg,
    border: `2px solid ${cssVars.colors.warning}`,
    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(200, 140, 20, 0.1))',
    backgroundColor: cssVars.colors.background,
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.warning,
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
    gap: isMobile ? cssVars.spacing.md : cssVars.spacing.xl,
    marginBottom: cssVars.spacing.lg,
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
    maxWidth: '140px',
  };

  const scoreControlsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const scoreButtonStyle: CSSProperties = {
    width: isMobile ? '56px' : '44px',
    height: isMobile ? '56px' : '44px',
    borderRadius: '50%',
    border: `2px solid ${cssVars.colors.border}`,
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
    fontSize: isMobile ? '56px' : '48px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    minWidth: isMobile ? '70px' : '60px',
    textAlign: 'center',
  };

  const colonStyle: CSSProperties = {
    fontSize: isMobile ? '36px' : '32px',
    color: cssVars.colors.textSecondary,
    fontWeight: cssVars.fontWeights.bold,
  };

  const currentScoreStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
    marginBottom: cssVars.spacing.md,
  };

  const buttonsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: cssVars.spacing.sm,
    justifyContent: 'center',
  };

  return (
    <div style={overlayStyle} onClick={onCancel}>
      {/* MF-004: Modal mit korrekten ARIA-Attributen */}
      <div
        ref={dialogRef}
        style={containerStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-score-dialog-title"
        tabIndex={-1}
      >
        <div id="edit-score-dialog-title" style={titleStyle}>
          <span aria-hidden="true">✏️</span>
          <span>Ergebnis korrigieren</span>
        </div>

        <div style={currentScoreStyle}>
          Aktueller Stand: <strong>{currentHomeScore} : {currentAwayScore}</strong>
        </div>

        <div style={scoreInputContainerStyle}>
          <div style={teamScoreBlockStyle}>
            <div style={teamNameStyle}>{homeTeamName}</div>
            <div style={scoreControlsStyle}>
              <button
                style={{
                  ...scoreButtonStyle,
                  opacity: homeScore === 0 ? 0.5 : 1,
                  cursor: homeScore === 0 ? 'not-allowed' : 'pointer',
                }}
                onClick={() => setHomeScore(Math.max(0, homeScore - 1))}
                disabled={homeScore === 0}
                type="button"
                aria-label={`Tore für ${homeTeamName} verringern`}
              >
                −
              </button>
              <div
                style={scoreDisplayStyle}
                aria-label={`Tore ${homeTeamName}: ${homeScore}`}
                role="text"
              >
                {homeScore}
              </div>
              <button
                style={scoreButtonStyle}
                onClick={() => setHomeScore(homeScore + 1)}
                type="button"
                aria-label={`Tore für ${homeTeamName} erhöhen`}
              >
                +
              </button>
            </div>
          </div>

          <div style={colonStyle}>:</div>

          <div style={teamScoreBlockStyle}>
            <div style={teamNameStyle}>{awayTeamName}</div>
            <div style={scoreControlsStyle}>
              <button
                style={{
                  ...scoreButtonStyle,
                  opacity: awayScore === 0 ? 0.5 : 1,
                  cursor: awayScore === 0 ? 'not-allowed' : 'pointer',
                }}
                onClick={() => setAwayScore(Math.max(0, awayScore - 1))}
                disabled={awayScore === 0}
                type="button"
                aria-label={`Tore für ${awayTeamName} verringern`}
              >
                −
              </button>
              <div
                style={scoreDisplayStyle}
                aria-label={`Tore ${awayTeamName}: ${awayScore}`}
                role="text"
              >
                {awayScore}
              </div>
              <button
                style={scoreButtonStyle}
                onClick={() => setAwayScore(awayScore + 1)}
                type="button"
                aria-label={`Tore für ${awayTeamName} erhöhen`}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div style={buttonsStyle}>
          <Button
            variant="primary"
            size={isMobile ? 'md' : 'sm'}
            onClick={handleSubmit}
            disabled={!hasChanged}
            style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
          >
            Speichern
          </Button>
          <Button
            variant="secondary"
            size={isMobile ? 'md' : 'sm'}
            onClick={onCancel}
            style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
          >
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
};
