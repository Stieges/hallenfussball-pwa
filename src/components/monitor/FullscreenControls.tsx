/* eslint-disable react-refresh/only-export-components -- Hook co-located with component for encapsulation */
/**
 * FullscreenControls - Fullscreen toggle and exit controls
 *
 * Features:
 * - Fullscreen toggle button
 * - Auto-hide after 3 seconds in fullscreen mode
 * - Reappears on mouse movement
 * - Mobile: Back button (Android), Swipe-down gesture (iOS)
 * - Fade in/out animation
 */

import { CSSProperties, useEffect, useRef, useCallback, useState } from 'react';
import { cssVars } from '../../design-tokens'
export interface FullscreenControlsProps {
  /** Whether currently in fullscreen mode */
  isFullscreen: boolean;
  /** Callback to toggle fullscreen */
  onToggleFullscreen: () => void;
  /** Auto-hide timeout in ms (default: 3000) */
  autoHideTimeout?: number;
  /** Children to render alongside controls (e.g., FieldSelector) */
  children?: React.ReactNode;
}

export const FullscreenControls: React.FC<FullscreenControlsProps> = ({
  isFullscreen,
  onToggleFullscreen,
  autoHideTimeout = 3000,
  children,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const hideTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Clear existing timeout
   */
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  /**
   * Start auto-hide timeout
   */
  const startHideTimeout = useCallback(() => {
    clearHideTimeout();
    if (isFullscreen) {
      hideTimeoutRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, autoHideTimeout);
    }
  }, [isFullscreen, autoHideTimeout, clearHideTimeout]);

  /**
   * Show controls and restart hide timeout
   */
  const showControls = useCallback(() => {
    setIsVisible(true);
    startHideTimeout();
  }, [startHideTimeout]);

  /**
   * Handle mouse movement
   */
  useEffect(() => {
    if (!isFullscreen) {
      setIsVisible(true);
      clearHideTimeout();
      return;
    }

    const handleMouseMove = () => {
      showControls();
    };

    // Touch support for mobile
    const handleTouchStart = () => {
      showControls();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchstart', handleTouchStart);

    // Start initial hide timeout
    startHideTimeout();

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchstart', handleTouchStart);
      clearHideTimeout();
    };
  }, [isFullscreen, showControls, startHideTimeout, clearHideTimeout]);

  /**
   * Handle Android back button (popstate)
   */
  useEffect(() => {
    if (!isFullscreen) {return;}

    const handlePopState = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
    };

    // Push a state to history so back button triggers popstate
    window.history.pushState({ fullscreen: true }, '');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isFullscreen]);

  /**
   * Handle keyboard Escape key
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        showControls();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, showControls]);

  const containerStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: cssVars.spacing.lg,
    zIndex: 1000,
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    pointerEvents: isVisible ? 'auto' : 'none',
    background: isFullscreen
      ? 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)'
      : 'transparent',
  };

  const childrenContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
  };

  const buttonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    background: 'rgba(0, 230, 118, 0.15)',
    border: `2px solid ${cssVars.colors.primary}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.bold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(4px)',
  };

  const handleButtonHover = (e: React.MouseEvent<HTMLButtonElement>, entering: boolean) => {
    const target = e.currentTarget;
    target.style.background = entering
      ? 'rgba(0, 230, 118, 0.3)'
      : 'rgba(0, 230, 118, 0.15)';
    target.style.transform = entering ? 'scale(1.02)' : 'scale(1)';
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Left side: Children (e.g., FieldSelector) */}
      <div style={childrenContainerStyle}>
        {children}
      </div>

      {/* Right side: Fullscreen toggle button */}
      <button
        onClick={onToggleFullscreen}
        style={buttonStyle}
        onMouseEnter={(e) => handleButtonHover(e, true)}
        onMouseLeave={(e) => handleButtonHover(e, false)}
        aria-label={isFullscreen ? 'Vollbild beenden' : 'Vollbild aktivieren'}
      >
        {isFullscreen ? (
          <>
            <span style={{ fontSize: cssVars.fontSizes.xl }}>✕</span>
            <span>Beenden</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: cssVars.fontSizes.xl }}>⛶</span>
            <span>Vollbild</span>
          </>
        )}
      </button>
    </div>
  );
};

/**
 * Hook for managing fullscreen state
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  }, []);

  const enterFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  }, []);

  return {
    isFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
