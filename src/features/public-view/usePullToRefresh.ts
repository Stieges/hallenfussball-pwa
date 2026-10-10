/**
 * Pull-to-refresh für die Zuschauer-Seite (B-13d1, aus LiveViewScreen ausgelagert).
 *
 * Verhalten unverändert: Ziehen nur am oberen Scroll-Rand, Dämpfung 0.5, max. 120px,
 * Auslösung ab Schwelle 80px.
 */
import { CSSProperties, RefObject, TouchEvent, useCallback, useRef, useState } from 'react';
import { cssVars } from '../../design-tokens';
import { useHaptic } from '../../hooks/useHaptic';

/** Mindestabstand in px, ab dem beim Loslassen aktualisiert wird */
export const PULL_THRESHOLD = 80;

const MAX_PULL_DISTANCE = 120;
const PULL_DAMPENING = 0.5;

export interface PullToRefreshHandlers {
  onTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: () => void;
}

export interface UsePullToRefreshResult {
  containerRef: RefObject<HTMLDivElement | null>;
  isRefreshing: boolean;
  pullDistance: number;
  handlers: PullToRefreshHandlers;
}

export function usePullToRefresh(onRefresh: () => Promise<void>): UsePullToRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { triggerHaptic } = useHaptic();

  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    // Only trigger if at top of scroll
    if (containerRef.current?.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (pullStartY.current === null || isRefreshing) {
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - pullStartY.current;

    // Only pull down, and apply dampening
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      const dampenedDistance = Math.min(diff * PULL_DAMPENING, MAX_PULL_DISTANCE);
      setPullDistance(dampenedDistance);
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      triggerHaptic('medium');
      setIsRefreshing(true);
      setPullDistance(0);
      void onRefresh().then(() => {
        triggerHaptic('success');
        setIsRefreshing(false);
      });
    } else {
      setPullDistance(0);
    }
    pullStartY.current = null;
  }, [pullDistance, isRefreshing, onRefresh, triggerHaptic]);

  return {
    containerRef,
    isRefreshing,
    pullDistance,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

/** Stil des Indikator-Balkens oberhalb des Inhalts */
export function getRefreshIndicatorStyle(pullDistance: number, isRefreshing: boolean): CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: `translateX(-50%) translateY(${pullDistance > 0 || isRefreshing ? '0' : '-100%'})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px`,
    width: '100%',
    transition: pullDistance > 0 ? 'none' : 'all 0.3s ease',
    overflow: 'hidden',
  };
}

/** Stil des Spinners im Indikator */
export function getRefreshSpinnerStyle(pullDistance: number, isRefreshing: boolean): CSSProperties {
  return {
    width: 32,
    height: 32,
    border: `3px solid ${cssVars.colors.border}`,
    borderTopColor: cssVars.colors.primary,
    borderRadius: '50%',
    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
    transform: isRefreshing ? 'none' : `rotate(${pullDistance * 3}deg)`,
    opacity: pullDistance > 20 || isRefreshing ? 1 : pullDistance / 20,
    transition: isRefreshing ? 'none' : 'opacity 0.1s ease',
  };
}
