/**
 * GameControls - Match control buttons
 *
 * Based on mockup: scoreboard-desktop.html
 * Controls: Undo, Start/Pause, Zeit, Seiten, Halbzeit, Beenden
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens'
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
  /** BUG-002: Event log button for mobile retroactive editing */
  onEventLog?: () => void;
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
  onEventLog,
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
    gap: isMobile ? cssVars.spacing.xs : cssVars.spacing.md,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: cssVars.spacing.lg,
    paddingTop: cssVars.spacing.lg,
    borderTop: `1px solid ${cssVars.colors.borderSolid}`,
  };

  // Button base
  const btnStyle: CSSProperties = {
    fontFamily: 'inherit',
    border: `1px solid ${cssVars.colors.borderSolid}`,
    borderRadius: cssVars.borderRadius.md,
    padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.md}` : cssVars.spacing.md,
    fontSize: isMobile ? '12px' : '13px',
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    background: 'transparent',
    color: cssVars.colors.textPrimary,
    transition: 'all 0.15s',
  };

  const btnStartStyle: CSSProperties = {
    ...btnStyle,
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.lg}` : `${cssVars.spacing.md} ${cssVars.spacing.xl}`,
    fontWeight: cssVars.fontWeights.bold,
    minWidth: isMobile ? '100px' : '140px',
  };

  const btnEndStyle: CSSProperties = {
    ...btnStyle,
    background: 'transparent',
    color: cssVars.colors.error,
    borderColor: cssVars.colors.error,
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

      {/* BUG-002: Event Log - Mobile only (Desktop has Sidebar) */}
      {isMobile && onEventLog && (
        <button
          style={btnStyle}
          onClick={onEventLog}
          type="button"
          aria-label="Ereignisprotokoll anzeigen"
          data-testid="match-event-log-button"
        >
          📋 Ereignisse
        </button>
      )}
    </div>
  );
};

export default GameControls;
