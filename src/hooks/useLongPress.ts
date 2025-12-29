/**
 * useLongPress - Long Press Detection Hook
 *
 * Detects long press gestures for mobile-friendly interactions.
 * Used in Live-Cockpit for decrementing goals with long press on +TOR buttons.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §2.2
 *
 * Features:
 * - Configurable delay (default: 500ms)
 * - Returns both short tap and long press handlers
 * - Cancels on move to prevent accidental triggers
 * - Works with both touch and mouse events
 */

import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  /** Delay in ms before long press is triggered (default: 500) */
  delay?: number;
  /** Callback for short tap/click */
  onShortPress?: () => void;
  /** Callback for long press */
  onLongPress?: () => void;
  /** Move threshold in pixels before canceling (default: 10) */
  moveThreshold?: number;
}

interface UseLongPressReturn {
  /** Event handlers to spread on the target element */
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
  };
  /** Whether currently in a press state */
  isPressed: boolean;
}

export function useLongPress({
  delay = 500,
  onShortPress,
  onLongPress,
  moveThreshold = 10,
}: UseLongPressOptions): UseLongPressReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const isPressedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePressStart = useCallback((x: number, y: number) => {
    isPressedRef.current = true;
    isLongPressRef.current = false;
    startPosRef.current = { x, y };

    clearTimer();

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      isPressedRef.current = false;
      onLongPress?.();
    }, delay);
  }, [delay, onLongPress, clearTimer]);

  const handlePressEnd = useCallback(() => {
    clearTimer();

    if (isPressedRef.current && !isLongPressRef.current) {
      // Short press (tap)
      onShortPress?.();
    }

    isPressedRef.current = false;
    isLongPressRef.current = false;
  }, [onShortPress, clearTimer]);

  const handleMove = useCallback((x: number, y: number) => {
    if (!isPressedRef.current) {return;}

    const deltaX = Math.abs(x - startPosRef.current.x);
    const deltaY = Math.abs(y - startPosRef.current.y);

    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      // Movement exceeded threshold, cancel long press
      clearTimer();
      isPressedRef.current = false;
    }
  }, [moveThreshold, clearTimer]);

  const handleCancel = useCallback(() => {
    clearTimer();
    isPressedRef.current = false;
    isLongPressRef.current = false;
  }, [clearTimer]);

  // Mouse event handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    handlePressStart(e.clientX, e.clientY);
  }, [handlePressStart]);

  const onMouseUp = useCallback((_e: React.MouseEvent) => {
    handlePressEnd();
  }, [handlePressEnd]);

  const onMouseLeave = useCallback((_e: React.MouseEvent) => {
    handleCancel();
  }, [handleCancel]);

  // Touch event handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handlePressStart(touch.clientX, touch.clientY);
  }, [handlePressStart]);

  const onTouchEnd = useCallback((_e: React.TouchEvent) => {
    handlePressEnd();
  }, [handlePressEnd]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [handleMove]);

  return {
    handlers: {
      onMouseDown,
      onMouseUp,
      onMouseLeave,
      onTouchStart,
      onTouchEnd,
      onTouchMove,
    },
    isPressed: isPressedRef.current,
  };
}

export default useLongPress;
