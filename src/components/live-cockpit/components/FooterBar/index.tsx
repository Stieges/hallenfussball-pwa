/**
 * FooterBar - Match Flow Control Actions
 *
 * Fixed at the bottom of the screen, provides:
 * - Start/Pause/Resume buttons
 * - Finish match button
 * - Next match / Reopen buttons (after match ends)
 *
 * Safe Area: Uses CSS module for iPhone notch support via env(safe-area-inset-bottom)
 */

import { useState, type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens'
import { SlideToConfirm } from '../SlideToConfirm';
import type { MatchStatus } from '../../types';
import type { Breakpoint } from '../../../../hooks';
import styles from '../../LiveCockpit.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FooterBarProps {
  status: MatchStatus;
  onStart: () => void;
  onPauseResume: () => void;
  onFinish: () => void;
  onLoadNextMatch?: () => void;
  onReopenLastMatch?: () => void;
  hasNextMatch?: boolean;
  hasLastFinished?: boolean;
  /** @deprecated Use breakpoint instead */
  isMobile?: boolean;
  breakpoint?: Breakpoint;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FooterBar: React.FC<FooterBarProps> = ({
  status,
  onStart,
  onPauseResume,
  onFinish,
  onLoadNextMatch,
  onReopenLastMatch,
  hasNextMatch = false,
  hasLastFinished = false,
  isMobile: isMobileProp,
  breakpoint = 'desktop',
}) => {
  // State for showing slide-to-confirm
  const [showSlideConfirm, setShowSlideConfirm] = useState(false);

  // Backwards compatibility: use isMobile prop if breakpoint not provided
  const isMobile = isMobileProp ?? breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';

  const isNotStarted = status === 'NOT_STARTED';
  const isRunning = status === 'RUNNING';
  const isPaused = status === 'PAUSED';
  const isFinished = status === 'FINISHED';

  // Handle finish confirmation
  const handleFinishConfirm = () => {
    setShowSlideConfirm(false);
    onFinish();
  };

  // ---------------------------------------------------------------------------
  // Styles - Safe area insets handled via CSS module
  // ---------------------------------------------------------------------------

  const footerStyle: CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
    padding: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
    background: cssVars.colors.surfaceSolid,
    borderTop: `1px solid ${cssVars.colors.border}`,
    boxShadow: `0 -2px 10px ${cssVars.colors.shadowSoft}`,
    zIndex: 50,
    // Safe area padding is handled by CSS module class
  };

  const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    width: '100%',
    maxWidth: '500px',
    justifyContent: 'center',
  };

  // ---------------------------------------------------------------------------
  // Render different states
  // ---------------------------------------------------------------------------

  // Responsive button size
  const buttonSize = isMobile ? 'large' : isTablet ? 'large' : 'medium';

  // Before match starts
  if (isNotStarted) {
    return (
      <footer style={footerStyle} className={styles.footerBar}>
        <div style={buttonContainerStyle}>
          <ActionButton
            onClick={onStart}
            variant="primary"
            size={buttonSize}
            fullWidth
            ariaLabel="Spiel starten"
          >
            ▶ Spiel starten
          </ActionButton>
        </div>
      </footer>
    );
  }

  // Match is running or paused
  if (isRunning || isPaused) {
    // Show slide-to-confirm when user clicks "Beenden"
    if (showSlideConfirm) {
      return (
        <footer style={footerStyle} className={styles.footerBar}>
          <div style={{ ...buttonContainerStyle, flexDirection: 'column', gap: cssVars.spacing.sm }}>
            <SlideToConfirm
              text="→ Zum Beenden schieben"
              confirmText="Spiel beendet!"
              onConfirm={handleFinishConfirm}
              trackColor={cssVars.colors.error}
            />
            <ActionButton
              onClick={() => setShowSlideConfirm(false)}
              variant="ghost"
              size="medium"
              ariaLabel="Abbrechen"
            >
              ✕ Abbrechen
            </ActionButton>
          </div>
        </footer>
      );
    }

    return (
      <footer style={footerStyle} className={styles.footerBar}>
        <div style={buttonContainerStyle}>
          <ActionButton
            onClick={onPauseResume}
            variant="secondary"
            size={buttonSize}
            ariaLabel={isRunning ? 'Spiel pausieren' : 'Spiel fortsetzen'}
          >
            {isRunning ? '⏸ Pause' : '▶ Fortsetzen'}
          </ActionButton>

          <ActionButton
            onClick={() => setShowSlideConfirm(true)}
            variant="danger"
            size={buttonSize}
            ariaLabel="Spiel beenden"
          >
            ⏹ Beenden
          </ActionButton>
        </div>
      </footer>
    );
  }

  // Match is finished
  if (isFinished) {
    return (
      <footer style={footerStyle} className={styles.footerBar}>
        <div style={buttonContainerStyle}>
          {hasNextMatch && onLoadNextMatch && (
            <ActionButton
              onClick={onLoadNextMatch}
              variant="primary"
              size={buttonSize}
              fullWidth={!hasLastFinished}
              ariaLabel="Nächstes Spiel laden"
            >
              → Nächstes Spiel laden
            </ActionButton>
          )}

          {hasLastFinished && onReopenLastMatch && (
            <ActionButton
              onClick={onReopenLastMatch}
              variant="ghost"
              size={buttonSize}
              ariaLabel="Letztes Spiel wiedereröffnen"
            >
              ↺ Wiedereröffnen
            </ActionButton>
          )}
        </div>
      </footer>
    );
  }

  return null;
};

// ---------------------------------------------------------------------------
// ActionButton - Styled button for footer actions
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'medium' | 'large';
  fullWidth?: boolean;
  children: React.ReactNode;
  ariaLabel?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  variant,
  size,
  fullWidth = false,
  children,
  ariaLabel,
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary': return cssVars.colors.primary;
      case 'secondary': return cssVars.colors.surfaceLight;
      case 'danger': return cssVars.colors.errorLight;
      case 'ghost': return 'transparent';
      default: return cssVars.colors.surface;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary': return cssVars.colors.onPrimary;
      case 'secondary': return cssVars.colors.textPrimary;
      case 'danger': return cssVars.colors.error;
      case 'ghost': return cssVars.colors.textSecondary;
      default: return cssVars.colors.textPrimary;
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'danger': return cssVars.colors.error;
      case 'ghost': return cssVars.colors.border;
      default: return 'transparent';
    }
  };

  // Get CSS module class for variant
  const getVariantClass = () => {
    switch (variant) {
      case 'primary': return styles.actionButtonPrimary;
      case 'danger': return styles.actionButtonDanger;
      default: return '';
    }
  };

  const buttonStyle: CSSProperties = {
    flex: fullWidth ? 1 : '0 0 auto',
    minHeight: size === 'large' ? '44px' : '40px',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    fontSize: size === 'large' ? cssVars.fontSizes.md : cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: getTextColor(),
    background: getBackgroundColor(),
    border: `1px solid ${getBorderColor()}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    boxShadow: variant === 'primary' ? `0 2px 8px ${cssVars.colors.primary}40` : 'none',
  };

  return (
    <button
      style={buttonStyle}
      className={`${styles.actionButton} ${getVariantClass()}`}
      onClick={onClick}
      type="button"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
};

export default FooterBar;
