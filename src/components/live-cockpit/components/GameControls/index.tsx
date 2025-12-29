/**
 * GameControls - Match control buttons
 *
 * Based on mockup: scoreboard-desktop.html
 * Controls: Undo, Start/Pause, Zeit, Seiten, Halbzeit, Beenden
 */

import { type CSSProperties } from 'react';
import { colors, spacing, fontWeights, borderRadius } from '../../../../design-tokens';
import type { Breakpoint } from '../../../../hooks';
import type { MatchStatus } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameControlsProps {
  status: MatchStatus;
  onUndo?: () => void;
  onStart: () => void;
  onPauseResume: () => void;
  onEditTime: () => void;
  onSwitchSides: () => void;
  onHalfTime: () => void;
  onFinish: () => void;
  canUndo?: boolean;
  breakpoint?: Breakpoint;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GameControls: React.FC<GameControlsProps> = ({
  status,
  onUndo,
  onStart,
  onPauseResume,
  onEditTime,
  onSwitchSides,
  onHalfTime,
  onFinish,
  canUndo = false,
  breakpoint = 'desktop',
}) => {
  const isMobile = breakpoint === 'mobile';
  const isRunning = status === 'RUNNING';
  const isPaused = status === 'PAUSED';
  const isNotStarted = status === 'NOT_STARTED';
  const isFinished = status === 'FINISHED';

  const containerStyle: CSSProperties = {
    display: 'flex',
    gap: isMobile ? spacing.xs : spacing.md,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTop: `1px solid ${colors.borderSolid}`,
  };

  // Button base
  const btnStyle: CSSProperties = {
    fontFamily: 'inherit',
    border: `1px solid ${colors.borderSolid}`,
    borderRadius: borderRadius.md,
    padding: isMobile ? `${spacing.sm} ${spacing.md}` : spacing.md,
    fontSize: isMobile ? '12px' : '13px',
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    background: 'transparent',
    color: colors.textPrimary,
    transition: 'all 0.15s',
  };

  const btnStartStyle: CSSProperties = {
    ...btnStyle,
    background: colors.primary,
    color: colors.onPrimary,
    border: 'none',
    padding: isMobile ? `${spacing.sm} ${spacing.lg}` : `${spacing.md} ${spacing.xl}`,
    fontWeight: fontWeights.bold,
    minWidth: isMobile ? '100px' : '140px',
  };

  const btnEndStyle: CSSProperties = {
    ...btnStyle,
    background: 'transparent',
    color: colors.error,
    borderColor: colors.error,
  };

  const btnUndoStyle: CSSProperties = {
    ...btnStyle,
    background: 'transparent',
    opacity: canUndo ? 1 : 0.5,
    cursor: canUndo ? 'pointer' : 'not-allowed',
  };

  // Main button label
  const getMainButtonLabel = (): string => {
    if (isNotStarted) {return '▶ Start';}
    if (isRunning) {return '⏸ Pause';}
    if (isPaused) {return '▶ Start';}
    return '▶ Start';
  };

  const handleMainButtonClick = () => {
    if (isNotStarted) {
      onStart();
    } else {
      onPauseResume();
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Undo */}
      {onUndo && (
        <button
          style={btnUndoStyle}
          onClick={onUndo}
          disabled={!canUndo}
          type="button"
          aria-label="Rückgängig"
          data-testid="match-undo-button"
        >
          ↩ {!isMobile && 'Rückgängig'}
        </button>
      )}

      {/* Start/Pause */}
      <button
        style={btnStartStyle}
        onClick={handleMainButtonClick}
        disabled={isFinished}
        type="button"
        aria-label={isRunning ? 'Pausieren' : 'Starten'}
        data-testid={isRunning ? 'match-pause-button' : 'match-start-button'}
      >
        {getMainButtonLabel()}
      </button>

      {/* Edit Time */}
      <button
        style={btnStyle}
        onClick={onEditTime}
        disabled={isFinished}
        type="button"
        aria-label="Zeit bearbeiten"
        data-testid="match-edit-time-button"
      >
        🕒 {!isMobile && 'Zeit'}
      </button>

      {/* Switch Sides */}
      <button
        style={btnStyle}
        onClick={onSwitchSides}
        disabled={isFinished}
        type="button"
        aria-label="Seiten tauschen"
      >
        🔄 {!isMobile && 'Seiten'}
      </button>

      {/* Half Time */}
      <button
        style={btnStyle}
        onClick={onHalfTime}
        disabled={isFinished}
        type="button"
        aria-label="Halbzeit"
      >
        🌓 {!isMobile && 'Halbzeit'}
      </button>

      {/* Finish */}
      <button
        style={btnEndStyle}
        onClick={onFinish}
        disabled={isFinished || isNotStarted}
        type="button"
        aria-label="Spiel beenden"
        data-testid="match-finish-button"
      >
        🏁 {!isMobile && 'Beenden'}
      </button>
    </div>
  );
};

export default GameControls;
