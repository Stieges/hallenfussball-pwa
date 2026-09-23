/**
 * GameControls - Match control buttons
 *
 * Based on mockup: scoreboard-desktop.html
 * Controls: Undo, Start/Pause, Zeit, Seiten, Halbzeit, Beenden
 */

import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
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
  onSettings?: () => void;
  /** BUG-002: Event log button for mobile retroactive editing */
  onEventLog?: () => void;
  canUndo?: boolean;
  breakpoint?: Breakpoint;
  /** Task R2: readOnly/finished lock (isLocked in LiveCockpit) — disables Undo, Start/Pause,
   *  Zeit, Seiten, Halbzeit, Beenden. Native `disabled` on each <button>, not just visual.
   *  Fixrunde 2/3 (M2, Review-Befund M): does NOT cover Settings or Event-Log — both had no
   *  `disabled` at all before R2 (commit 235d947) and must stay that way, auch unter readOnly.
   *  Settings zeigt echte, synchronisierte Werte (kein Lokalzustand) — Regel 2 erlaubt "ansehen",
   *  also öffnet sich der Dialog immer; die Eingaben darin sperrt stattdessen
   *  MatchCockpitSettingsPanel selbst über ein natives `<fieldset disabled>` (siehe dort). */
  disabled?: boolean;
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
  onSettings,
  onEventLog,
  canUndo = false,
  breakpoint = 'desktop',
  disabled = false,
}) => {
  const { t } = useTranslation('cockpit');
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
    minHeight: '44px', // WCAG Touch Target
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    background: 'transparent',
    color: cssVars.colors.textPrimary,
    opacity: disabled ? 0.5 : 1,
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
    opacity: disabled || !canUndo ? 0.5 : 1,
    cursor: disabled || !canUndo ? 'not-allowed' : 'pointer',
  };

  // Task R2 Fixrunde 2/3 (M2, Review-Befund M): Settings- und Event-Log-Button sind NIE über
  // `disabled` gesperrt — öffnen/ansehen bleibt immer erlaubt (siehe `disabled`-Doc-Kommentar
  // oben). Für Settings sperrt stattdessen MatchCockpitSettingsPanel selbst die Eingaben unter
  // readOnly (natives <fieldset disabled>, Regel 2: "ansehen bleibt erlaubt").
  const btnNeverLockedStyle: CSSProperties = {
    ...btnStyle,
    cursor: 'pointer',
    opacity: 1,
  };

  // Main button label
  const getMainButtonLabel = (): string => {
    if (isNotStarted) { return t('controls.start'); }
    if (isRunning) { return t('controls.pause'); }
    if (isPaused) { return t('controls.start'); }
    return t('controls.start');
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
          disabled={disabled || !canUndo}
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
        disabled={disabled || isFinished}
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
        disabled={disabled || isFinished}
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
        disabled={disabled || isFinished}
        type="button"
        aria-label="Seiten tauschen"
      >
        🔄 {!isMobile && 'Seiten'}
      </button>

      {/* Half Time */}
      <button
        style={btnStyle}
        onClick={onHalfTime}
        disabled={disabled || isFinished}
        type="button"
        aria-label="Halbzeit"
      >
        🌓 {!isMobile && 'Halbzeit'}
      </button>

      {/* Finish */}
      <button
        style={btnEndStyle}
        onClick={onFinish}
        disabled={disabled || isFinished || isNotStarted}
        type="button"
        aria-label="Spiel beenden"
        data-testid="match-finish-button"
      >
        🏁 {!isMobile && 'Beenden'}
      </button>

      {/* Settings — Task R2 Fixrunde 2/3 (M2, Review-Befund M): nie über `disabled` gesperrt, der
          Dialog öffnet sich immer (Regel 2: Settings zeigt echte Werte, "ansehen" bleibt
          erlaubt); die Eingaben sperrt MatchCockpitSettingsPanel selbst unter readOnly. */}
      {onSettings && (
        <button
          style={btnNeverLockedStyle}
          onClick={onSettings}
          type="button"
          aria-label="Einstellungen"
        >
          ⚙️ {!isMobile && 'Optionen'}
        </button>
      )}

      {/* BUG-002: Event Log - Mobile only (Desktop has Sidebar). Task R2 Fixrunde 2 (M2/Regel 2):
          nie über `disabled` gesperrt — öffnen zum Lesen bleibt immer erlaubt. */}
      {isMobile && onEventLog && (
        <button
          style={btnNeverLockedStyle}
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
