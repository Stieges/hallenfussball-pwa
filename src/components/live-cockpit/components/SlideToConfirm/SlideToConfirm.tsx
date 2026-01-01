/**
 * SlideToConfirm - Swipe Gesture Confirmation
 *
 * A mobile-friendly slide-to-confirm component for dangerous actions
 * like ending a match. Requires user to slide the thumb fully across
 * to prevent accidental triggers.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §3.3
 *
 * Features:
 * - Smooth drag animation with spring back
 * - Haptic feedback on completion
 * - Visual progress indicator
 * - Customizable text and colors
 */

import { useState, useRef, useCallback } from 'react';
import { cssVars } from '../../../../design-tokens'
import { triggerHaptic } from '../../../../utils/haptics';

interface SlideToConfirmProps {
  /** Text shown in the slider */
  text?: string;
  /** Text shown after sliding (confirmation) */
  confirmText?: string;
  /** Callback when slide is completed */
  onConfirm: () => void;
  /** Background color of the track */
  trackColor?: string;
  /** Color of the thumb/slider */
  thumbColor?: string;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Threshold percentage to trigger confirm (0-1, default: 0.9) */
  threshold?: number;
}

export function SlideToConfirm({
  text = 'Zum Beenden schieben',
  confirmText = 'Beendet!',
  onConfirm,
  trackColor = cssVars.colors.error,
  thumbColor = cssVars.colors.onError,
  disabled = false,
  threshold = 0.9,
}: SlideToConfirmProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const THUMB_WIDTH = 56;

  const getProgress = useCallback((clientX: number) => {
    if (!trackRef.current) {return 0;}
    const rect = trackRef.current.getBoundingClientRect();
    const maxDrag = rect.width - THUMB_WIDTH;
    const currentX = clientX - rect.left - THUMB_WIDTH / 2;
    return Math.max(0, Math.min(1, currentX / maxDrag));
  }, []);

  const handleStart = useCallback((clientX: number) => {
    if (disabled || isConfirmed) {return;}
    startXRef.current = clientX;
    setIsDragging(true);
    triggerHaptic('light');
  }, [disabled, isConfirmed]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging) {return;}
    const newProgress = getProgress(clientX);
    setProgress(newProgress);

    // Haptic feedback at milestones
    if (newProgress > 0.5 && progress <= 0.5) {
      triggerHaptic('medium');
    }
    if (newProgress > 0.75 && progress <= 0.75) {
      triggerHaptic('medium');
    }
  }, [isDragging, getProgress, progress]);

  const handleEnd = useCallback(() => {
    if (!isDragging) {return;}
    setIsDragging(false);

    if (progress >= threshold) {
      // Confirm action
      setIsConfirmed(true);
      setProgress(1);
      triggerHaptic('success');
      onConfirm();
    } else {
      // Spring back
      setProgress(0);
    }
  }, [isDragging, progress, threshold, onConfirm]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX);
  }, [handleStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleMove(e.clientX);
  }, [handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      handleEnd();
    }
  }, [isDragging, handleEnd]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const trackWidth = trackRef.current?.offsetWidth ?? 200;
  const thumbPosition = progress * (trackWidth - THUMB_WIDTH);

  return (
    <div
      ref={trackRef}
      style={{
        ...styles.track,
        backgroundColor: isConfirmed ? cssVars.colors.success : trackColor,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress fill */}
      <div
        style={{
          ...styles.progressFill,
          width: `${progress * 100}%`,
          backgroundColor: isConfirmed ? cssVars.colors.success : `${thumbColor}30`,
        }}
      />

      {/* Text */}
      <span
        style={{
          ...styles.text,
          opacity: isConfirmed ? 1 : 1 - progress,
        }}
      >
        {isConfirmed ? confirmText : text}
      </span>

      {/* Thumb */}
      {!isConfirmed && (
        <div
          style={{
            ...styles.thumb,
            backgroundColor: thumbColor,
            left: thumbPosition,
            transition: isDragging ? 'none' : 'left 0.3s ease-out',
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <span style={styles.thumbIcon}>→</span>
        </div>
      )}

      {/* Checkmark when confirmed */}
      {isConfirmed && (
        <div style={styles.checkmark}>✓</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  track: {
    position: 'relative',
    width: '100%',
    height: 56,
    borderRadius: cssVars.borderRadius.full,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    transition: 'width 0.1s ease-out',
  },
  text: {
    position: 'relative',
    fontSize: cssVars.fontSizes.md,
    fontWeight: 600,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'opacity 0.2s ease',
    pointerEvents: 'none',
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 56,
    height: 56,
    borderRadius: cssVars.borderRadius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 2px 8px ${cssVars.colors.shadowMedium}`,
    cursor: 'grab',
    zIndex: 1,
  },
  thumbIcon: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: 700,
    color: cssVars.colors.error,
  },
  checkmark: {
    position: 'absolute',
    fontSize: cssVars.fontSizes.xl,
    fontWeight: 700,
    color: 'white',
  },
};

export default SlideToConfirm;
