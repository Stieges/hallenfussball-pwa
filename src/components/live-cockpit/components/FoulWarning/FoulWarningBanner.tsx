/**
 * FoulWarningBanner - 5 Fouls Warning Display
 *
 * Shows a prominent warning when a team reaches 5 accumulated fouls.
 * According to futsal rules, from the 6th foul onwards, the opposing team
 * gets a direct free kick from 10m without wall.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §3.2
 *
 * Features:
 * - Animated entry/exit
 * - Haptic feedback when triggered
 * - Auto-dismiss after 5 seconds (configurable)
 * - Shows which team has reached the limit
 */

import { useEffect, useState, useCallback } from 'react';
import { cssVars } from '../../../../design-tokens'
import { triggerHaptic } from '../../../../utils/haptics';

interface FoulWarningBannerProps {
  /** Team name that reached 5 fouls */
  teamName: string;
  /** Current foul count */
  foulCount: number;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss after X milliseconds (0 = never, default: 5000) */
  autoDismissMs?: number;
  /** Whether to show the banner */
  isVisible: boolean;
}

export function FoulWarningBanner({
  teamName,
  foulCount,
  onDismiss,
  autoDismissMs = 5000,
  isVisible,
}: FoulWarningBannerProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle visibility changes with animation
  useEffect(() => {
    let rafId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (isVisible) {
      setShouldRender(true);
      // Trigger haptic when warning appears
      triggerHaptic('warning');
      // Small delay for mount animation
      rafId = requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      // Wait for exit animation before unmounting
      timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
    }

    return () => {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [isVisible]);

  // Auto-dismiss timer
  useEffect(() => {
    if (isVisible && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoDismissMs, onDismiss]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      style={{
        ...styles.container,
        opacity: isAnimating ? 1 : 0,
        transform: isAnimating ? 'translateY(0)' : 'translateY(-20px)',
      }}
      role="alert"
      aria-live="assertive"
    >
      <div style={styles.content}>
        <div style={styles.iconContainer}>
          <span style={styles.icon}>⚠️</span>
          <span style={styles.foulBadge}>{foulCount}</span>
        </div>
        <div style={styles.textContainer}>
          <span style={styles.title}>Foul-Limit erreicht!</span>
          <span style={styles.description}>
            {teamName} hat {foulCount} Fouls. Ab dem nächsten Foul: Freistoß ohne Mauer.
          </span>
        </div>
        <button
          style={styles.dismissButton}
          onClick={handleDismiss}
          aria-label="Warnung schließen"
        >
          ✕
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {autoDismissMs > 0 && (
        <div style={styles.progressContainer}>
          <div
            style={{
              ...styles.progressBar,
              animationDuration: `${autoDismissMs}ms`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: cssVars.spacing.lg,
    left: cssVars.spacing.lg,
    right: cssVars.spacing.lg,
    backgroundColor: cssVars.colors.warningBannerBg,
    borderRadius: cssVars.borderRadius.lg,
    border: `2px solid ${cssVars.colors.warning}`,
    boxShadow: `0 4px 20px ${cssVars.colors.warningShadow}`,
    zIndex: 1100,
    overflow: 'hidden',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
  },
  iconContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  icon: {
    fontSize: '32px',
  },
  foulBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cssVars.colors.error,
    color: cssVars.colors.onError,
    borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: 700,
    padding: `0 4px`,
  },
  textContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  title: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: 700,
    color: cssVars.colors.warning,
  },
  description: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    lineHeight: 1.3,
  },
  dismissButton: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.md,
    cursor: 'pointer',
    flexShrink: 0,
  },
  progressContainer: {
    height: 3,
    backgroundColor: cssVars.colors.warningBannerBgStrong,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: cssVars.colors.warning,
    animation: 'shrinkWidth linear forwards',
  },
};

export default FoulWarningBanner;
